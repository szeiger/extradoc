package com.novocode.extradoc.json

import scala.tools.nsc.doc._
import model._
import comment._

import java.io.{PrintStream, FileOutputStream, BufferedOutputStream, StringWriter, File => JFile}
import scala.collection._

abstract class AbstractJsonFactory {

  def prepareModel(universe: Universe) = {
    println("Building JSON model")
    val (allModels, allModelsReverse) = buildModels(universe)
    while(allModels.size > allModelsReverse.size) compact(allModels, allModelsReverse)
    if(allModels.keys.max + 1 != allModels.size) renumber(allModels, allModelsReverse)
    if(allModels.keys.max + 1 != allModels.size)
      throw new RuntimeException("Renumbering failed: Max key "+allModels.keys.max+" for size "+allModels.size)
    println("Verifying JSON model")
    val (verOk, linkCount) = verify(allModels)
    println("Verified "+linkCount+" links")
    if(!verOk) throw new RuntimeException("Model verification failed")
    (allModels, allModelsReverse)
  }

  def buildModels(universe: Universe) = {
    val globalEntityOrdinals = new mutable.HashMap[EntityHash[Entity], Int]
    val allModels = new mutable.HashMap[Int, JBase]
    val allModelsReverse = new mutable.HashMap[JBase, Int]
    val builder = new JsonBuilder[Link] {
      def global[T <: Entity](e: T)(f: T => JBase) = globalEntityOrdinals.get(EntityHash(e)) match {
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

  def verify(m: mutable.HashMap[Int, JBase]): (Boolean, Int) = {
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
    (ok, count)
  }

  def compact(allModels: mutable.HashMap[Int, JBase], allModelsReverse: mutable.HashMap[JBase, Int]) {
    val duplicates = allModels.keys.toSet -- allModelsReverse.values
    val repl = duplicates map { i => (Link(i), Link(allModelsReverse(allModels(i)))) } toMap;
    println("Replacing duplicates: " + repl)
    allModels --= duplicates
    def replaceIn(j: JBase) {
      j replaceLinks repl
      j.children map { replaceIn _ }
    }
    allModels.values map { replaceIn _ }
    allModelsReverse.clear
    for((ord, j) <- allModels) allModelsReverse += j -> ord
    println("Compacted to "+allModels.size+" global objects ("+allModelsReverse.size+" unique)")
  }

  def renumber(allModels: mutable.HashMap[Int, JBase], allModelsReverse: mutable.HashMap[JBase, Int]) {
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
    allModelsReverse.clear
    for((ord, j) <- allModels) allModelsReverse += j -> ord
  }
}
