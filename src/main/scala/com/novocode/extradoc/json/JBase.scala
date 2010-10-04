package com.novocode.extradoc.json

import scala.tools.nsc.doc._
import model._
import comment._

import java.io.{Writer, StringWriter}
import scala.collection._

abstract class CanBeValue[-T] {
  def isEmpty(v: T): Boolean
  def writeValue(v: T, out: Writer, resolveLink: Link => Any): Unit
}
object CanBeValue {
  implicit val jBaseCanBeValue = new CanBeValue[JBase] {
    def isEmpty(v: JBase) = v.isEmpty
    def writeValue(v: JBase, out: Writer, resolveLink: Link => Any) =
      v.writeTo(out, resolveLink)
  }
  implicit val intCanBeValue = new CanBeValue[Int] {
    def isEmpty(v: Int) = false
    def writeValue(v: Int, out: Writer, resolveLink: Link => Any) =
      out write v.toString
  }
  implicit val stringCanBeValue = new CanBeValue[String] {
    def isEmpty(v: String) = v == ""
    def writeValue(v: String, out: Writer, resolveLink: Link => Any) =
      JBase.quote(v, out)
  }
  implicit val booleanCanBeValue = new CanBeValue[Boolean] {
    def isEmpty(v: Boolean) = v == false
    def writeValue(v: Boolean, out: Writer, resolveLink: Link => Any) =
      out write v.toString
  }
  implicit val linkCanBeValue = new CanBeValue[Link] {
    def isEmpty(v: Link) = false
    def writeValue(v: Link, out: Writer, resolveLink: Link => Any) = {
      val resolved = resolveLink(v)
      recoverFor(resolved).writeValue(resolved, out, resolveLink)
    }
  }
  def recoverFor(v: Any): CanBeValue[Any] = v match {
    case _:JBase => jBaseCanBeValue.asInstanceOf[CanBeValue[Any]]
    case _:Int => intCanBeValue.asInstanceOf[CanBeValue[Any]]
    case _:String => stringCanBeValue.asInstanceOf[CanBeValue[Any]]
    case _:Boolean => booleanCanBeValue.asInstanceOf[CanBeValue[Any]]
    case _:Link => linkCanBeValue.asInstanceOf[CanBeValue[Any]]
  }
}

sealed abstract class JBase {
  def writeTo(out: Writer, resolveLink: Link => Any): Unit
  def isEmpty: Boolean
  def links: Iterable[Link]
  def children: Iterable[JBase]
  def replaceLinks[T : CanBeValue](repl: Map[Link, T]): Unit

  def foreachRec(f: JBase => Unit) {
    f(this)
    children foreach { _.foreachRec(f) }
  }
  override def toString = {
    val wr = new StringWriter
    writeTo(wr, {_.target})
    wr.toString
  }
}

object JBase {
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
  def writeTo(out: Writer, resolveLink: Link => Any) {
    out write '{'
    var first = true
    for((k,v) <- m) {
      if(first) first = false else out write ','
      JBase.quote(k, out)
      out write ':'
      CanBeValue.recoverFor(v).writeValue(v, out, resolveLink)
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
  def replaceLinks[T : CanBeValue](repl: Map[Link, T]) = m transform { case(k,v) =>
    v match {
      case l: Link => repl get l getOrElse l
      case _ => v
    }
  }
  def apply(key: String) = m get key
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
  def writeTo(out: Writer, resolveLink: Link => Any) {
    out write '['
    var first = true
    for(v <- a) {
      if(first) first = false else out write ','
      CanBeValue.recoverFor(v).writeValue(v, out, resolveLink)
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
  def replaceLinks[T : CanBeValue](repl: Map[Link, T]) {
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
  def values = a.iterator
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
