package com.novocode.extradoc.json

import scala.tools.nsc.doc._
import model._
import comment._

import scala.collection._
import scala.xml.{Xhtml, NodeSeq, NodeBuffer, Text, Elem}

abstract class JsonBuilder[Link : CanBeValue] {

  val typeEntitiesAsHtml: Boolean
  val compactFlags: Boolean

  def global[T <: Entity](e: T)(f: T => JBase): Link

  def as[T](o: AnyRef)(f: T => Unit)(implicit m: ClassManifest[T]): Unit =
    if(m.erasure.isInstance(o)) f(o.asInstanceOf[T])

  class CollectingHtmlGen extends HtmlGen {
    val links = new JArray
    def ref(e: TemplateEntity) = {
      links += global(e)(createEntity _)
      "#"
    }
  }

  def createVisibility(v: Visibility): JObject = {
    val j = new JObject
    if(!compactFlags) {
      if(v.isProtected) j += "isProtected" -> true
      if(v.isPublic) j += "isPublic" -> true
      if(v.isInstanceOf[PrivateInInstance]) j += "isPrivateInInstance" -> true
      if(v.isInstanceOf[ProtectedInInstance]) j += "isProtectedInInstance" -> true
    }
    as[PrivateInTemplate](v) { p =>
      if(!compactFlags) j += "isPrivateInTemplate" -> true
      j += "owner" -> global(p.owner)(createEntity _)
    }
    as[ProtectedInTemplate](v) { p =>
      if(!compactFlags) j += "isProtectedInTemplate" -> true
      j += "owner" -> global(p.owner)(createEntity _)
    }
    j
  }

  def createHtml(f: HtmlGen => NodeSeq) = {
    val gen = new CollectingHtmlGen
    val ns = f(gen)
    val j = new JObject
    j +?= "_links" -> gen.links
    j += "_html" -> gen.mkString(ns)
    j
  }

  def createBody(b: Body) = createHtml(_.bodyToHtml(b))

  def createBlock(b: Block) = createHtml(_.blockToHtml(b))

  def createInline(i: Inline) = createHtml(_.inlineToHtml(i))

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
    if(typeEntitiesAsHtml) {
      val b = new NodeBuffer
      val links = new mutable.ArrayBuffer[Link]
      val name = t.name
      var pos = 0
      t.refEntity foreach { case (start, (ref, len)) =>
        if(pos < start) b += Text(name.substring(pos, start))
        links += global(ref)(createEntity _)
        b += Elem(null, "a", null, xml.TopScope, Text(name.substring(start, start+len)))
        pos = start+len
      }
      if(pos < name.length-1) b += Text(name.substring(pos))
      j += "_xname" -> Xhtml.toXhtml(b)
      j +?= "_refs" -> JArray(links)
    } else {
      j += "name" -> t.name
      j +?= "refEntity" -> JArray(t.refEntity.map {
        case (k,v) =>
          val vv = new JObject
          vv += "s" -> k
          vv += "l" -> v._2
          vv += "e" -> global(v._1)(createEntity _)
          vv
      })
    }
    j
  }

  def createEntity(e: Entity): JObject = {
    val j = new JObject
    j += "inTemplate" -> global(e.inTemplate)(createEntity _)
    // "toRoot" is own ID plus recursively toRoot of inTemplate
    //j += "toRoot" -> JArray(e.toRoot.map(e => global(e)(createEntity _)))
    val qName = e.qualifiedName
    var name = e.name
    val sep1 = qName.lastIndexOf('#')
    val sep2 = qName.lastIndexOf('.')
    val sep = if(sep1 > sep2) sep1 else sep2
    if(sep > 0 && qName.substring(sep+1) == name || sep == -1 && qName == name) name = null
    j += "qName" -> e.qualifiedName
    if(name ne null) j += "name" -> e.name
    as[TemplateEntity](e) { t =>
      if(compactFlags) {
        if(t.isPackage) set(j, 'p')
        if(t.isRootPackage) set(j, 'r')
        if(t.isTrait) set(j, 't')
        if(t.isClass) set(j, 'c')
        if(t.isObject) set(j, 'b')
        if(t.isDocTemplate) set(j, 'D')
      } else {
        if(t.isPackage) j += "isPackage" -> true
        if(t.isRootPackage) j += "isRootPackage" -> true
        if(t.isTrait) j += "isTrait" -> true
        if(t.isClass) j += "isClass" -> true
        if(t.isObject) j += "isObject" -> true
        if(t.isDocTemplate) j += "isDocTemplate" -> true
      }
    }
    //as[NoDocTemplate](e) { t => j += "isNoDocTemplate" -> true }
    as[MemberEntity](e) { m =>
      m.comment foreach { c => j += "comment" -> createComment(c) }
      j += "inDefinitionTemplates" -> JArray(m.inDefinitionTemplates.map(e => global(e)(createEntity _)))
      j +?= "definitionName" -> m.definitionName
      if(compactFlags) {
        if(m.visibility.isProtected) set(j, 'o')
        if(m.visibility.isPublic) set(j, 'u')
        if(m.visibility.isInstanceOf[PrivateInInstance]) set(j, 'i')
        if(m.visibility.isInstanceOf[ProtectedInInstance]) set(j, 'O')
        if(m.visibility.isInstanceOf[PrivateInTemplate]) set(j, 'e')
        if(m.visibility.isInstanceOf[ProtectedInTemplate]) set(j, 'E')
      }
      j +?= "visibility" -> createVisibility(m.visibility)
      m.flags.map(createBlock _) foreach { fj =>
        fj("_html") match {
          case Some("<p>sealed</p>") =>
            if(compactFlags) set(j, 's') else j += "isSealed" -> true
          case Some("<p>abstract</p>") =>
            if(compactFlags) set(j, 'B') else j += "isAbstract" -> true
          case Some("<p>final</p>") =>
            if(compactFlags) set(j, 'f') else j += "isFinal" -> true
          case _ =>
        }
      }
      m.deprecation foreach { d => j += "deprecation" -> createBody(d) }
      j +?= "inheritedFrom" -> JArray(m.inheritedFrom.map(e => global(e)(createEntity _)))
      j += "resultType" -> createTypeEntity(m.resultType)
      if(compactFlags) {
        if(m.isDef) set(j, 'd')
        if(m.isVal) set(j, 'v')
        if(m.isLazyVal) set(j, 'l')
        if(m.isVar) set(j, 'V')
        if(m.isImplicit) set(j, 'm')
        if(m.isConstructor) set(j, 'n')
        if(m.isAliasType) set(j, 'a')
        if(m.isAbstractType) set(j, 'A')
        if(m.isTemplate) set(j, 'M')
      } else {
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
    }
    as[DocTemplateEntity](e) { t =>
      t.sourceUrl foreach { u => j +?= "sourceUrl" -> u.toString }
      j +?= "typeParams" -> JArray(t.typeParams.map(e => global(e)(createEntity _)))
      t.parentType foreach { p => j += "parentType" -> createTypeEntity(p) }
      j +?= "parentTemplates" -> JArray(t.parentTemplates.map(e => global(e)(createEntity _)))
      j +?= "linearization" -> JArray(t.linearization.map(e => global(e)(createEntity _)))
      j +?= "subClasses" -> JArray(t.subClasses.map(e => global(e)(createEntity _)))
      // "members" is constructors + templates + methods + values + abstractTypes + aliasTypes + packages
      //j +?= "members" -> JArray(t.members.map(e => global(e)(createEntity _)))
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
      c.primaryConstructor foreach { c => j += "primaryConstructor" -> global(c)(createEntity _) }
      j +?= "constructors" -> JArray(c.constructors.map(e => global(e)(createEntity _)))
      if(c.isCaseClass) {
        if(compactFlags) set(j, 'C')
        else j += "isCaseClass" -> true
      }
    }
    as[Package](e) { p => j +?= "packages" -> JArray(p.packages.map(e => global(e)(createEntity _))) }
    as[NonTemplateMemberEntity](e) { n =>
      if(n.isUseCase) {
        if(compactFlags) set(j, 'U')
        else j += "isUseCase" -> true
      }
    }
    as[Def](e) { d =>
      j +?= "typeParams" -> JArray(d.typeParams.map(e => global(e)(createEntity _)))
      j +?= "valueParams" -> JArray(d.valueParams.map(l => JArray(l.map(e => global(e)(createEntity _)))))
    }
    as[Constructor](e) { c =>
      if(c.isPrimary) {
        if(compactFlags) set(j, 'P')
        else j += "isPrimary" -> true
      }
      j +?= "valueParams" -> JArray(c.valueParams.map(l => JArray(l.map(e => global(e)(createEntity _)))))
    }
    as[AbstractType](e) { a =>
      a.lo foreach { t => j +?= "lo" -> createTypeEntity(t) }
      a.hi foreach { t => j +?= "hi" -> createTypeEntity(t) }
    }
    as[AliasType](e) { a => j += "alias" -> createTypeEntity(a.alias) }
    as[ParameterEntity](e) { p =>
      if(compactFlags) {
        if(p.isTypeParam) set(j, 'y')
        if(p.isValueParam) set(j, 'R')
      } else {
        if(p.isTypeParam) j += "isTypeParam" -> true
        if(p.isValueParam) j += "isValueParam" -> true
      }
      j -= "inTemplate"
    }
    as[TypeParam](e) { t =>
      j +?= "variance" -> t.variance
      t.lo foreach { t => j +?= "lo" -> createTypeEntity(t) }
      t.hi foreach { t => j +?= "hi" -> createTypeEntity(t) }
    }
    as[ValueParam](e) { v =>
      j += "resultType" -> createTypeEntity(v.resultType)
      v.defaultValue foreach { s => j += "defaultValue" -> s }
      if(v.isImplicit) {
        if(compactFlags) set(j, 'm')
        else j += "isImplicit" -> true
      }
    }
    j
  }

  /**
   * Set a flag in the "is" field.
   * o: isProtected
   * u: isPublic
   * i: isPrivateInInstance
   * O: isProtectedInInstance
   * e: isPrivateInTemplate
   * E: isProtectedInTemplate
   * p: isPackage
   * r: isRootPackage
   * t: isTrait
   * c: isClass
   * b: isObject
   * D: isDocTemplate
   * d: isDef
   * v: isVal
   * l: isLazyVal
   * V: isVar
   * m: isImplicit
   * n: isConstructor
   * a: isAliasType
   * A: isAbstractType
   * M: isTemplate
   * C: isCaseClass
   * U: isUseCase
   * P: isPrimary
   * y: isTypeParam
   * R: isValueParam
   * s: isSealed
   * B: isAbstract
   * f: isFinal
   */
  def set(j: JObject, flag: Char) {
    j += "is" -> ((j("is") getOrElse "") + flag.toString)
  }
}
