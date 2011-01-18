package com.novocode.extradoc.json

import scala.tools.nsc.doc._
import model._
import comment._

import java.io.{PrintStream, FileOutputStream, BufferedOutputStream, StringWriter, File => JFile}
import scala.tools.nsc.io.{ Streamable, Directory }
import scala.collection._

abstract class AbstractJsonFactory(val universe: Universe) { self =>

  val doInline = true
  val typeEntitiesAsHtml = false
  val compactFlags = false
  val removeSimpleBodyDocs = false
  val simpleParamsAsString = false

  def prepareModel(universe: Universe) = {
    println("Building JSON model")
    val (allModels, allModelsReverse) = buildModels(universe)
    if(simpleParamsAsString) inlineSimpleParams(allModels, allModelsReverse)
    while(allModels.size > allModelsReverse.size) compact(allModels, allModelsReverse)
    if(doInline) inline(allModels)
    if(allModels.keys.max + 1 != allModels.size) renumber(allModels)
    if(allModels.keys.max + 1 != allModels.size)
      throw new RuntimeException("Renumbering failed: Max key "+allModels.keys.max+" for size "+allModels.size)
    val (verOk, _) = verify(allModels)
    if(!verOk) throw new RuntimeException("Model verification failed")
    allModels
  }

  def buildModels(universe: Universe) = {
    val globalEntityOrdinals = new mutable.HashMap[EntityHash[Entity], Int]
    val allModels = new mutable.HashMap[Int, JObject]
    val allModelsReverse = new mutable.HashMap[JObject, Int]
    val builder = new JsonBuilder[Link] {
      val typeEntitiesAsHtml = self.typeEntitiesAsHtml
      val compactFlags = self.compactFlags
      val removeSimpleBodyDocs = self.removeSimpleBodyDocs
      def global[T <: Entity](e: T)(f: T => JObject) = globalEntityOrdinals.get(EntityHash(e)) match {
        case Some(ord) => Link(ord)
        case None =>
          val ord = globalEntityOrdinals.size
          globalEntityOrdinals += EntityHash(e) -> ord
          val o = f(e)
          if(ord +1 == globalEntityOrdinals.size) {
            // No dependent entities were built by f, so there cannot be any references to ord yet
            allModels += ord -> o
            allModelsReverse get o match {
              case Some(oldOrd) =>
                globalEntityOrdinals remove EntityHash(e)
                Link(oldOrd)
              case None =>
                allModels += ord -> o
                allModelsReverse += o -> ord
                Link(ord)
            }
          } else {
            allModels += ord -> o
            allModelsReverse += o -> ord
            Link(ord)
          }
      }
    }
    builder.global(universe.rootPackage)(builder.createEntity _)
    println("Built "+allModels.size+" global objects ("+allModelsReverse.size+" unique)")
    (allModels, allModelsReverse)
  }

  def verify(m: mutable.HashMap[Int, JObject]): (Boolean, Int) = {
    println("Verifying JSON model")
    var ok = true
    var count = 0
    val verified = new mutable.HashSet[Int]
    def f(ord: Int, j: JBase) {
      if(ord == -1 || !(verified contains ord)) {
        if(ord != -1) verified += ord
        for(ch <- j.links) {
          count += 1
          m get ch.target match {
            case Some(j) =>
              f(ch.target, j)
            case None =>
              println("Model verification error: Link target "+ch.target+" not found")
              ok = false
          }
        }
        for(ch <- j.children) f(-1, ch)
      }
    }
    for((ord, j) <- m) f(ord, j)
    println("Verified "+count+" links and "+m.size+" global objects")
    (ok, count)
  }

  def compact(allModels: mutable.HashMap[Int, JObject], allModelsReverse: mutable.HashMap[JObject, Int]) {
    val duplicates = allModels.keys.toSet -- allModelsReverse.values
    val repl = duplicates map { i => (Link(i), Link(allModelsReverse(allModels(i)))) } toMap;
    println("Replacing duplicates: " + repl)
    allModels --= duplicates
    def replaceIn(j: JBase) {
      j replaceLinks repl
      j.children foreach { replaceIn _ }
    }
    allModels.values foreach { replaceIn _ }
    allModelsReverse.clear
    for((ord, j) <- allModels) allModelsReverse += j -> ord
    println("Compacted to "+allModels.size+" global objects ("+allModelsReverse.size+" unique)")
  }

  def inlineSimpleParams(allModels: mutable.HashMap[Int, JObject], allModelsReverse: mutable.HashMap[JObject, Int]) {
    def simple(l: Int) = {
      val j = allModels(l)
      if(j.keys.toSet -- Set("name", "qName") isEmpty)
        nameFor(j) filter { _.length < 7 }
      else None
    }
    allModels.values foreach { j =>
      j("typeParams", JArray.Empty) transform {
        case (_, l @ Link(t)) => simple(t) getOrElse l
        case (_, o) => o
      }
      /* j("valueParams", JArray.Empty).values foreach {
        case a: JArray =>
          a transform {
            case (_, l @ Link(t)) => simple(t) getOrElse l
            case (_, o) => o
          }
        case _ =>
      } */
    }
    allModelsReverse.clear
    for((ord, j) <- allModels) allModelsReverse += j -> ord
    println("Compacted to "+allModels.size+" global objects ("+allModelsReverse.size+" unique)")
  }

  def renumber(allModels: mutable.HashMap[Int, JObject]) {
    println("Renumbering objects")
    val repl = allModels.keys.toSeq.sorted.zipWithIndex.toMap
    val linkRepl = repl map { case (k,v) => (Link(k), Link(v)) }
    def replaceIn(j: JBase) {
      j replaceLinks linkRepl
      j.children map { replaceIn _ }
    }
    allModels.values foreach { replaceIn _ }
    val newM = allModels.toSeq map { case (ord, j) => (repl(ord), j) };
    allModels.clear
    allModels ++= newM
  }

  def findGlobal(allModels: mutable.HashMap[Int, JObject]) = {
    val global = new mutable.HashSet[Int]
    def f(ord: Int) {
      if(!(global contains ord)) {
        val j = allModels(ord)
        if(j !! "isTemplate" || j("is", "").contains('M')) {
          global += ord
          j("members", JArray.Empty).values foreach {
            case Link(target) => f(target)
            case _ =>
          }
        }
      }
    }
    f(0)
    global
  }

  def inline(allModels: mutable.HashMap[Int, JObject]) {
    println("Finding objects to inline")
    val keep = findGlobal(allModels)
    allModels.values foreach {
      _ foreachRec {
        _ match {
          case j: JObject =>
            j("_links", JArray.Empty).values foreach {
              keep += _.asInstanceOf[Link].target
            }
          case _ =>
        }
      }
    }
    println("Protecting "+keep.size+" objects")
    val counts = new mutable.HashMap[Int, Int]
    allModels.values foreach {
      _ foreachRec {
        _.links foreach { l =>
          counts += l.target -> (counts.getOrElse(l.target, 0) + 1)
        }
      }
    }
    val toInline = (counts filter { case (_,c) => c <= 1 } keys).toSet -- keep
    if(!toInline.isEmpty) {
      println("Inlining/eliminating "+toInline.size+" objects")
      val repl = toInline map { i => (Link(i), allModels(i)) } toMap;
      allModels --= toInline
      def replaceIn(j: JBase) {
        j replaceLinks repl
        j.children map { replaceIn _ }
      }
      allModels.values foreach { replaceIn _ }
    }
  }

  lazy val siteRoot: JFile = new JFile(universe.settings.outdir.value)

  def copyResource(resPath: String, subPath: String) {
    val bytes = new Streamable.Bytes {
      val inputStream = getClass.getResourceAsStream(resPath + "/" + subPath)
      assert(inputStream != null)
    }.toByteArray
    val dest = Directory(siteRoot) / subPath
    dest.parent.createDirectory()
    val out = dest.toFile.bufferedOutput()
    try out.write(bytes, 0, bytes.length)
    finally out.close()
  }

  def qNameToName(qName: String) = {
    val (s1, s2) = (qName.lastIndexOf('#'), qName.lastIndexOf('.'))
    val sep = if(s1 > s2) s1 else s2
    qName.substring(sep+1)
  }

  def nameFor(j: JObject) =
    (j("name") orElse { j("qName") map { q => qNameToName(q.asInstanceOf[String]) } }).asInstanceOf[Option[String]]
}
