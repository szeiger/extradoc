package com.novocode.extradoc.json

import scala.tools.nsc.doc._
import model._
import comment._

import java.io.{PrintStream, FileOutputStream, BufferedOutputStream, StringWriter, File => JFile}
import scala.collection._

class JsonFactory(val universe: Universe) extends AbstractJsonFactory {

  def generate(universe: Universe): Unit = {
    val (allModels, allModelsReverse) = prepareModel(universe)
    println("Writing scaladoc.json")
    JsonWriter(universe.settings.outdir.value, "scaladoc.json") createArray { w =>
      for((ord, m) <- allModels.toSeq.sortBy(_._1)) {
        w write m
      }
    }
  }
}
