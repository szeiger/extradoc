/* This source file is based on NSC -- new Scala compiler -- Copyright 2007-2010 LAMP/EPFL */

package com.novocode.extradoc

import java.io.File

import scala.collection.mutable.ArrayBuffer
import scala.tools.nsc._
import scala.tools.nsc.reporters.{Reporter, ConsoleReporter}
import scala.tools.nsc.util.FakePos //{Position}
import Properties.msilLibPath
import File.pathSeparator

/** The main class for scaladoc, a front-end for the Scala compiler 
 *  that generates documentation from source files.
 */
object ExtraDoc {

  val versionMsg: String = "ExtraDoc - based on ScalaDoc" +
    Properties.versionString + " -- " +
    Properties.copyrightString

  var reporter: ConsoleReporter = _
  
  def scalaFiles(base: File, name: String): Seq[String] = {
    val b = new ArrayBuffer[String]
    def collect(f: File, s: String) {
      //println("Scanning "+f.getPath)
      val fn = f.getName
      if(f.isDirectory) {
        if(fn == "." || !fn.startsWith(".")) {
          val files = f.listFiles
          if(files ne null) files foreach { ch => collect(ch, null) }
        }
      } else if(s ne null) b += s
      else if(fn endsWith ".scala") b += f.getPath
    }
    collect(base, name)
    b
  }

  def error(msg: String): Unit = {
    reporter.error(FakePos("scalac"), msg + "\n  scalac -help  gives more information")
  }

  def process(args: Array[String]): Unit = {
    
    val docSettings = new ExtraDocSettings(error)
    
    reporter = new ConsoleReporter(docSettings)
    
    val command =
      new CompilerCommand(args.toList, docSettings)
      
    if (!reporter.hasErrors) { // No need to continue if reading the command generated errors
      
      if (docSettings.version.value)
        reporter.info(null, versionMsg, true)
      else if (docSettings.help.value) {
        reporter.info(null, command.usageMsg, true)
      }
      else if (docSettings.Xhelp.value) 
        reporter.info(null, command.xusageMsg, true)
      else if (docSettings.Yhelp.value) 
        reporter.info(null, command.yusageMsg, true)
      else if (docSettings.showPlugins.value)
        reporter.warning(null, "Plugins are not available when using Scaladoc")
      else if (docSettings.showPhases.value)
        reporter.warning(null, "Phases are restricted when using Scaladoc")
      else try {
        
        if (docSettings.target.value == "msil")
          msilLibPath foreach (x => docSettings.assemrefs.value += (pathSeparator + x))
        
        val sourcePath = docSettings.sourcepath.value
        val expFiles = command.files.flatMap { fname: String =>
          val f = if(sourcePath == "") new File(fname) else new File(sourcePath, fname)
          scalaFiles(f, fname)
        }
        val docProcessor = new DocFactory(reporter, docSettings)
        //println("Found sources: "+expFiles.mkString(","))
        docProcessor.document(expFiles)
        
      }
      catch {
        case ex @ FatalError(msg) =>
          if (docSettings.debug.value) ex.printStackTrace();
          reporter.error(null, "fatal error: " + msg)
      }
      finally {
        reporter.printSummary()
      }
    }
    
  }

  def main(args: Array[String]): Unit = {
    process(args)
    exit(if (reporter.hasErrors) 1 else 0)
  }
  
}
