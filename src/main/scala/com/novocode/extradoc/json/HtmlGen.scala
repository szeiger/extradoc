package com.novocode.extradoc.json

import scala.tools.nsc.doc._
import model._
import comment._

import scala.collection._
import scala.xml.{Xhtml, NodeSeq}

abstract class HtmlGen extends html.HtmlPage {
  def path: List[String] = Nil
  protected def title: String = ""
  protected def headers: NodeSeq = NodeSeq.Empty
  protected def body: NodeSeq = NodeSeq.Empty

  def ref(e: TemplateEntity): String

  def mkString(ns: NodeSeq) = Xhtml.toXhtml(ns)

  override def relativeLinkTo(destClass: TemplateEntity): String = "#" + ref(destClass)
}
