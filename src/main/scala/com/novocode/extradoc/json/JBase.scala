package com.novocode.extradoc.json

import scala.tools.nsc.doc._
import model._
import comment._

import java.io.Writer
import scala.collection._

abstract class CanBeValue[-T] { def isEmpty(v: T): Boolean }
object CanBeValue {
  implicit val jBaseCanBeValue = new CanBeValue[JBase] { def isEmpty(v: JBase) = v.isEmpty }
  implicit val intCanBeValue = new CanBeValue[Int] { def isEmpty(v: Int) = false }
  implicit val stringCanBeValue = new CanBeValue[String] { def isEmpty(v: String) = v == "" }
  implicit val booleanCanBeValue = new CanBeValue[Boolean] { def isEmpty(v: Boolean) = v == false }
  implicit val linkCanBeValue = new CanBeValue[Link] { def isEmpty(v: Link) = false }
}

sealed abstract class JBase {
  def writeTo(out: Writer): Unit
  def isEmpty: Boolean
  def links: Iterable[Link]
  def children: Iterable[JBase]
  def replaceLinks(repl: Map[Link, Link]): Unit

  def quote(s: String, wr: Writer) {
    wr write '"'
    val len = s.length
    var i = 0
    while(i < len) {
      val c = s.charAt(i)
      if(c == '"') wr write "\\\""
      else if(c == '\\') wr write "\\\\"
      else if(c == '\r') wr write "\\r"
      else if(c == '\n') wr write "\\n"
      else if(c >= 32 && c <= 127) wr write c
      else wr write "\\u" + "%04X".format(c.toInt)
      i += 1
    }
    wr write '"'
  }
}

final class JObject extends JBase {
  private val m = new mutable.HashMap[String, Any]
  def += [V](t: (String, V))(implicit cv: CanBeValue[V]) {
    if(m contains t._1) throw new RuntimeException("Cannot overwrite field "+t._1)
    m += t
  }
  def +?= [V](t: (String, V))(implicit cv: CanBeValue[V]) =
    if(!cv.isEmpty(t._2)) this += t
  def -= (k: String) = m remove k
  def isEmpty = m.isEmpty
  def writeTo(out: Writer) {
    out write '{'
    var first = true
    for((k,v) <- m) {
      if(first) first = false else out write ','
      quote(k, out)
      out write ':'
      v match {
        case j: JBase => j writeTo out
        case s: String => quote(s, out)
        case o => out write o.toString
      }
    }
    out write '}'
  }
  override def equals(o: Any) = o match {
    case j: JObject => m == j.m
    case _ => false
  }
  override def hashCode = m.hashCode
  def links = m.values.filter(_.isInstanceOf[Link]).asInstanceOf[Iterable[Link]]
  def children = m.values.filter(_.isInstanceOf[JBase]).asInstanceOf[Iterable[JBase]]
  def replaceLinks(repl: Map[Link, Link]) = m transform { case(k,v) =>
    v match {
      case l: Link => repl get l getOrElse l
      case _ => v
    }
  }
}

object JObject {
  def apply: JObject = new JObject
  def apply[V : CanBeValue](t: Traversable[(String,V)]): JObject = {
    val o = new JObject
    t foreach { case (k,v) => o += k -> v }
    o
  }
}

final class JArray extends JBase {
  private val a = new mutable.ArrayBuffer[Any]
  def += [T](v: T)(implicit cv: CanBeValue[T]) = a += v
  def +?= [T](v: T)(implicit cv: CanBeValue[T]) = if(!cv.isEmpty(v)) a += v
  def isEmpty = a.isEmpty
  def writeTo(out: Writer) {
    out write '['
    var first = true
    for(v <- a) {
      if(first) first = false else out write ','
      v match {
        case j: JBase => j writeTo out
        case s: String => quote(s, out)
        case o => out write o.toString
      }
    }
    out write ']'
  }
  override def equals(o: Any) = o match {
    case j: JArray => a == j.a
    case _ => false
  }
  override def hashCode = a.hashCode
  def links = a.filter(_.isInstanceOf[Link]).asInstanceOf[Iterable[Link]]
  def children = a.filter(_.isInstanceOf[JBase]).asInstanceOf[Iterable[JBase]]
  def replaceLinks(repl: Map[Link, Link]) {
    var len = a.length
    var i = 0
    while(i < len) {
      a(i) match {
        case l: Link => repl get l foreach { a(i) = _ }
        case _ =>
      }
      i += 1
    }
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

case class Link(target: Int) {
  override def toString = target.toString
}
