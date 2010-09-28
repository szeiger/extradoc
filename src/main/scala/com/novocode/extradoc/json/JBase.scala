package com.novocode.extradoc.json

import scala.tools.nsc.doc._
import model._
import comment._

import java.io.PrintStream
import scala.collection._

abstract class CanBeValue[-T] { def isEmpty(v: T): Boolean }
object CanBeValue {
  implicit val jBaseCanBeValue = new CanBeValue[JBase] { def isEmpty(v: JBase) = v.isEmpty }
  implicit val intCanBeValue = new CanBeValue[Int] { def isEmpty(v: Int) = false }
  implicit val stringCanBeValue = new CanBeValue[String] { def isEmpty(v: String) = v == "" }
  implicit val booleanCanBeValue = new CanBeValue[Boolean] { def isEmpty(v: Boolean) = v == false }
}

final class CanBeKey[-T]
object CanBeKey {
  implicit val intCanBeKey = new CanBeKey[Int]
  implicit val stringCanBeKey = new CanBeKey[String]
}

abstract class JBase {
  def write(out: PrintStream): Unit
  def isEmpty: Boolean

  def quote(s: String) =
    '"' + s.flatMap(c => (c match {
      case '"' => "\\\""
      case '\\' => "\\\\"
      case '\r' => "\\r"
      case '\n' => "\\n"
      case c if c >= 32 && c <= 127 => c.toString
      case c => "\\u" + "%04X".format(c.toInt)
    }):String) + '"'
}

final class JObject extends JBase {
  private[this] val m = new mutable.HashMap[Any, Any]
  def += [K, V](t: (K, V))(implicit ck: CanBeKey[K], cv: CanBeValue[V]) {
    if(m contains t._1) throw new RuntimeException("Cannot overwrite field "+t._1)
    m += t
  }
  def +?= [K, V](t: (K, V))(implicit ck: CanBeKey[K], cv: CanBeValue[V]) =
    if(!cv.isEmpty(t._2)) this += t
  def isEmpty = m.isEmpty
  def write(out: PrintStream) {
    out.print('{')
    var first = true
    for((k,v) <- m) {
      if(first) first = false else out.print(',')
      k match {
        case s: String => out.print(quote(s))
        case o => out.print(o)
      }
      out.print(':')
      v match {
        case j: JBase => j.write(out)
        case s: String => out.print(quote(s))
        case o => out.print(o)
      }
    }
    out.print('}')
  }
}

object JObject {
  def apply: JObject = new JObject
  def apply[K : CanBeKey, V : CanBeValue](t: Traversable[(K,V)]): JObject = {
    val o = new JObject
    t foreach { case (k,v) => o += k -> v }
    o
  }
}

final class JArray extends JBase {
  private[this] val a = new mutable.ArrayBuffer[Any]
  def += [T](v: T)(implicit cv: CanBeValue[T]) = a += v
  def +?= [T](v: T)(implicit cv: CanBeValue[T]) = if(!cv.isEmpty(v)) a += v
  def isEmpty = a.isEmpty
  def write(out: PrintStream) {
    out.print('[')
    var first = true
    for(v <- a) {
      if(first) first = false else out.print(',')
      v match {
        case j: JBase => j.write(out)
        case s: String => out.print(quote(s))
        case o => out.print(o)
      }
    }
    out.print(']')
  }
}

object JArray {
  def apply: JArray = new JArray
  def apply[T : CanBeValue](t: Traversable[T]): JArray = {
    val a = new JArray
    t foreach { j => a += j }
    a
  }
}
