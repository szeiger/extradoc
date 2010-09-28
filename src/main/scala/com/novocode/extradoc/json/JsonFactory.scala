package com.novocode.extradoc.json

import scala.tools.nsc.doc._
import model._
import comment._

import java.io.{PrintStream, FileOutputStream, BufferedOutputStream, StringWriter, File => JFile}
import scala.collection._
import scala.xml.{Xhtml, NodeSeq}

class JsonFactory(val universe: Universe) {

  def as[T](o: AnyRef)(f: T => Unit)(implicit m: ClassManifest[T]): Unit =
    if(m.erasure.isInstance(o)) f(o.asInstanceOf[T])

  def generate(universe: Universe): Unit = {

    var out: PrintStream = null
    var outFirst = true
    val globalEntityOrdinals = new mutable.HashMap[RefId[AnyRef], Int]
    lazy val htmlGen = new HtmlGen {
      def ref(e: TemplateEntity) = global(e)(createEntity _)
    }

    def createVisibility(v: Visibility): JObject = {
      val j = new JObject
      if(v.isProtected) j += "isProtected" -> true
      if(v.isPublic) j += "isPublic" -> true
      if(v.isInstanceOf[PrivateInInstance]) j += "isPrivateInInstance" -> true
      if(v.isInstanceOf[ProtectedInInstance]) j += "isProtectedInInstance" -> true
      as[PrivateInTemplate](v) { p =>
        j += "isPrivateInTemplate" -> true
        j += "owner" -> global(p.owner)(createEntity _)
      }
      as[ProtectedInTemplate](v) { p =>
        j += "isProtectedInTemplate" -> true
        j += "owner" -> global(p.owner)(createEntity _)
      }
      j
    }

    def createBody(b: Body): String = htmlGen.mkString(htmlGen.bodyToHtml(b))

    def createBlock(b: Block): String = htmlGen.mkString(htmlGen.blockToHtml(b))

    def createInline(i: Inline): String = htmlGen.mkString(htmlGen.inlineToHtml(i))

    def createComment(c: Comment): JObject = {
      val j = new JObject
      j +?= "body" -> createBody(c.body)
      j +?= "short" -> createInline(c.short)
      j +?= "authors" -> JArray(c.authors.map(createBody _))
      j +?= "see" -> JArray(c.see.map(createBody _))
      c.result foreach { b => j +?= "result" -> createBody(b) }
      j +?= "throws" -> JObject(c.throws.map { case (k,v) => k -> createBody(v) })
      j +?= "valueParams" -> JObject(c.valueParams.map { case (k,v) => k -> createBody(v) })
      j +?= "typeParams" -> JObject(c.typeParams.map { case (k,v) => k -> createBody(v) })
      j
      c.version foreach { b => j +?= "version" -> createBody(b) }
      c.since foreach { b => j +?= "since" -> createBody(b) }
      j +?= "todo" -> JArray(c.todo.map(createBody _))
      c.deprecated foreach { b => j +?= "deprecated" -> createBody(b) }
      j +?= "note" -> JArray(c.note.map(createBody _))
      j +?= "example" -> JArray(c.example.map(createBody _))
      j
    }

    def createTypeEntity(t: TypeEntity): JObject = {
      val j = new JObject
      j += "name" -> t.name
      j += "refEntity" -> JObject(t.refEntity.map { case (k,v) => k -> JArray(Seq(global(v._1)(createEntity _), v._2)) })
      j
    }

    def createEntity(e: Entity): JObject = {
      val j = new JObject
      j += "name" -> e.name
      j += "inTemplate" -> global(e.inTemplate)(createEntity _)
      //j += "toRoot" -> JArray(e.toRoot.map(e => global(e)(createEntity _)))
      j += "qualifiedName" -> e.qualifiedName
      as[TemplateEntity](e) { t =>
        if(t.isPackage) j += "isPackage" -> true
        if(t.isRootPackage) j += "isRootPackage" -> true
        if(t.isTrait) j += "isTrait" -> true
        if(t.isClass) j += "isClass" -> true
        if(t.isObject) j += "isObject" -> true
        if(t.isDocTemplate) j += "isDocTemplate" -> true
      }
      //as[NoDocTemplate](e) { t => j += "isNoDocTemplate" -> true }
      as[MemberEntity](e) { m =>
        m.comment foreach { c => j += "comment" -> createComment(c) }
        j += "inDefinitionTemplates" -> JArray(m.inDefinitionTemplates.map(e => global(e)(createEntity _)))
        j +?= "definitionName" -> m.definitionName
        j += "visibility" -> createVisibility(m.visibility)
        j +?= "flags" -> JArray(m.flags.map(createBlock _))
        m.deprecation foreach { d => j += "deprecation" -> createBody(d) }
        j +?= "inheritedFrom" -> JArray(m.inheritedFrom.map(e => global(e)(createEntity _)))
        j += "resultType" -> createTypeEntity(m.resultType)
        if(m.isDef) j += "isDef" -> true
        if(m.isVal) j += "isVal" -> true
        if(m.isLazyVal) j += "isLazyVal" -> true
        if(m.isVar) j += "isVar" -> true
        if(m.isImplicit) j += "isImplicit" -> true
        if(m.isConstructor) j += "isConstructor" -> true
        if(m.isAliasType) j += "isAliasType" -> true
        if(m.isAbstractType) j += "isAbstractType" -> true
        if(m.isTemplate) j += "isTemplate" -> true
      }
      as[DocTemplateEntity](e) { t =>
        t.sourceUrl foreach { u => j +?= "sourceUrl" -> u.toString }
        j +?= "typeParams" -> JArray(t.typeParams.map(e => global(e)(createEntity _)))
        t.parentType foreach { p => j += "parentType" -> createTypeEntity(p) }
        j +?= "parentTemplates" -> JArray(t.parentTemplates.map(e => global(e)(createEntity _)))
        j +?= "linearization" -> JArray(t.linearization.map(e => global(e)(createEntity _)))
        j +?= "subClasses" -> JArray(t.subClasses.map(e => global(e)(createEntity _)))
        j +?= "members" -> JArray(t.members.map(e => global(e)(createEntity _)))
        j +?= "templates" -> JArray(t.templates.map(e => global(e)(createEntity _)))
        j +?= "methods" -> JArray(t.methods.map(e => global(e)(createEntity _)))
        j +?= "values" -> JArray(t.values.map(e => global(e)(createEntity _)))
        j +?= "abstractTypes" -> JArray(t.abstractTypes.map(e => global(e)(createEntity _)))
        j +?= "aliasTypes" -> JArray(t.aliasTypes.map(e => global(e)(createEntity _)))
        t.companion foreach { p => j += "companion" -> global(p)(createEntity _) }
      }
      as[Trait](e) { t =>
        j +?= "valueParams" -> JArray(t.valueParams.map(l => JArray(l.map(e => global(e)(createEntity _)))))
      }
      as[Class](e) { c =>
        c.primaryConstructor foreach { c => global(c)(createEntity _) }
        j +?= "constructors" -> JArray(c.constructors.map(e => global(e)(createEntity _)))
        if(c.isCaseClass) j += "isCaseClass" -> true
      }
      as[Package](e) { p => j +?= "packages" -> JArray(p.packages.map(e => global(e)(createEntity _))) }
      as[NonTemplateMemberEntity](e) { n => if(n.isUseCase) j += "isUseCase" -> true }
      as[Def](e) { d =>
        j +?= "typeParams" -> JArray(d.typeParams.map(e => global(e)(createEntity _)))
        j +?= "valueParams" -> JArray(d.valueParams.map(l => JArray(l.map(e => global(e)(createEntity _)))))
      }
      as[Constructor](e) { c =>
        if(c.isPrimary) j += "isPrimary" -> true
        j +?= "valueParams" -> JArray(c.valueParams.map(l => JArray(l.map(e => global(e)(createEntity _)))))
      }
      as[AbstractType](e) { a =>
        a.lo foreach { t => j +?= "lo" -> createTypeEntity(t) }
        a.hi foreach { t => j +?= "hi" -> createTypeEntity(t) }
      }
      as[AliasType](e) { a => j += "alias" -> createTypeEntity(a.alias) }
      as[ParameterEntity](e) { p =>
        if(p.isTypeParam) j += "isTypeParam" -> true
        if(p.isValueParam) j += "isValueParam" -> true
      }
      as[TypeParam](e) { t =>
        j +?= "variance" -> t.variance
        t.lo foreach { t => j +?= "lo" -> createTypeEntity(t) }
        t.hi foreach { t => j +?= "hi" -> createTypeEntity(t) }
      }
      as[ValueParam](e) { v =>
        j += "resultType" -> createTypeEntity(v.resultType)
        v.defaultValue foreach { s => j += "defaultValue" -> s }
        if(v.isImplicit) j += "isImplicit" -> true
      }
      j
    }

    def global[T <: AnyRef](e: T)(f: T => JBase) = globalEntityOrdinals.get(RefId(e)) match {
      case Some(ord) => ord
      case None =>
        val ord = globalEntityOrdinals.size
        globalEntityOrdinals += RefId(e) -> ord
        val o = f(e)
        if(outFirst) outFirst = false else out println ','
        out print ord
        out print ':'
        o.write(out)
        ord
    }

    val fOut = new FileOutputStream(new JFile(new JFile(universe.settings.outdir.value), "scaladoc.json"))
    try {
      out = new PrintStream(new BufferedOutputStream(fOut))
      out print '{'
      global(universe.rootPackage)(createEntity _)
      out println '}'
      out.flush()
    } finally { fOut.close() }
  }
}

abstract class HtmlGen extends html.HtmlPage {
  def path: List[String] = Nil
  protected def title: String = ""
  protected def headers: NodeSeq = NodeSeq.Empty
  protected def body: NodeSeq = NodeSeq.Empty

  def ref(e: TemplateEntity): Int

  def mkString(ns: NodeSeq) = Xhtml.toXhtml(ns)

  override def relativeLinkTo(destClass: TemplateEntity): String = "##" + ref(destClass)
}
