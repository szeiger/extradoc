package com.novocode.extradoc.json

import scala.tools.nsc.doc._
import model._
import comment._

import java.io.{FileOutputStream, OutputStreamWriter, BufferedWriter, File => JFile}
import scala.collection._

case class JsonWriter(dir: JFile, fname: String) {

  private[this] var bwr: BufferedWriter = null
  private[this] var first = true

  object ObjectWriter {
    def write(k: String, v: JBase, resolveLink: Link => Any) {
      if(first) first = false else bwr write ",\n"
      bwr write "\""+k+"\":"
      v.writeTo(bwr, resolveLink)
    }
  }

  object ArrayWriter {
    def write(v: JBase, resolveLink: Link => Any) {
      if(first) first = false else bwr write ",\n"
      v.writeTo(bwr, resolveLink)
    }
  }

  def createObject(f: ObjectWriter.type => Unit) {
    val fOut = new FileOutputStream(new JFile(dir, fname))
    try {
      bwr = new BufferedWriter(new OutputStreamWriter(fOut, "ISO-8859-1"), 1024*1024)
      bwr write '{'
      f(ObjectWriter)
      bwr write "}\n"
      bwr.flush()
    } finally { fOut.close() }
  }

  def createArray(f: ArrayWriter.type => Unit) {
    val fOut = new FileOutputStream(new JFile(dir, fname))
    try {
      bwr = new BufferedWriter(new OutputStreamWriter(fOut, "ISO-8859-1"), 1024*1024)
      bwr write '['
      f(ArrayWriter)
      bwr write "]\n"
      bwr.flush()
    } finally { fOut.close() }
  }
}
