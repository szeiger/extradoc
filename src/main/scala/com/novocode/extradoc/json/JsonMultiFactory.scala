package com.novocode.extradoc.json

import scala.tools.nsc.doc._
import model._
import comment._

import java.io.{PrintStream, FileOutputStream, BufferedOutputStream, StringWriter, File => JFile}
import scala.collection._

class JsonMultiFactory(val universe: Universe) extends AbstractJsonFactory {

  // Global inlining is harmful for multi-page output because it increases
  // the size of extra objects which are included in many pages
  override val doInline = false

  case class Page(no: Int, main: Int) {
    val objects = new mutable.HashSet[Int]
    val renumbered = new mutable.ArrayBuffer[Int]
  }

  def generate(universe: Universe): Unit = {
    val (allModels, _) = prepareModel(universe)
    val pages = findGlobal(allModels).toSeq.sorted.
      zipWithIndex map { case (ord,idx) => (ord, Page(idx, ord))} toMap;
    def findPage(j: JBase): Option[Page] = j match {
      case j: JObject => j("inTemplate") match {
        case Some(Link(target)) =>
          pages get target orElse (allModels get target flatMap (findPage _))
        case Some(j: JObject) => findPage(j)
        case None => None
      }
      case _ => None
    }
    var extra = new mutable.HashSet[Int]
    allModels foreach { case (ord, j) =>
      (findPage(j) map (_.objects) getOrElse extra) += ord
    }
    println("Mapping "+extra.size+" extra objects to all pages that need them")
    var extraTotal = 0
    pages.values foreach { p =>
      p.objects map allModels foreach {
        _ foreachRec {
          _.links foreach { l =>
            if(extra contains l.target) {
              if(!(p.objects contains l.target)) {
                extraTotal += 1
                p.objects += l.target
              }
            }
          }
        }
      }
    }
    println("Total number of extra objects on all pages: "+extraTotal)
    println("Inlining extras on all pages")
    val keepHtmlLinks = new mutable.HashSet[Int]
    allModels.values foreach {
      _ foreachRec {
        _ match {
          case j: JObject =>
            j("_links") foreach {
              _.asInstanceOf[JArray].values foreach {
                keepHtmlLinks += _.asInstanceOf[Link].target
              }
            }
          case _ =>
        }
      }
    }
    var totalInlined = 0
    val counts = new mutable.HashMap[Int, Int]
    allModels.values foreach {
      _ foreachRec {
        _.links foreach { l =>
          if((extra contains l.target) && !(keepHtmlLinks contains l.target))
            counts += l.target -> (counts.getOrElse(l.target, 0) + 1)
        }
      }
    }
    for(p <- pages.values) {
      val toInline = (counts filter { case (_,c) => c <= 1 } keys).toSet
      if(!toInline.isEmpty) {
        totalInlined += toInline.size
        val repl = toInline map { i => (Link(i), allModels(i)) } toMap;
        p.objects --= toInline
        def replaceIn(j: JBase) {
          j replaceLinks repl
          j.children map { replaceIn _ }
        }
        allModels filter { case (ord, j) => p.objects contains ord } map { _._2 } foreach { replaceIn _ }
      }
    }
    println("Inlined "+totalInlined+" extra objects")
    val remappedIDs = new mutable.HashMap[Link, (Int, Int)]
    for(p <- pages.values) {
      p.renumbered += p.main
      remappedIDs += Link(p.main) -> (p.no, 0)
      p.objects foreach { ord =>
        remappedIDs += Link(ord) -> (p.no, p.renumbered.size)
        p.renumbered += ord
      }
    }
    println("Writing p0.json to p"+(pages.size-1)+".json")
    for(p <- pages.values) {
      val renumberedMap = p.renumbered.zipWithIndex.toMap
      JsonWriter(universe.settings.outdir.value, "p"+p.no+".json") createArray { w =>
        for(ord <- p.renumbered) {
          w.write(allModels(ord), { l: Link =>
            renumberedMap get l.target getOrElse {
              val (page, idx) = remappedIDs(l)
              JArray(Seq(page, idx))
            }
          })
        }
      }
    }
  }
}
