package com.novocode.extradoc.json

import scala.tools.nsc.doc._
import model._
import comment._

import java.io.{PrintStream, FileOutputStream, BufferedOutputStream, StringWriter, File => JFile}
import scala.collection._

class JsonMultiFactory(universe: Universe, explorer: Boolean = false) extends AbstractJsonFactory(universe) {

  // Global inlining is harmful for multi-page output because it increases
  // the size of extra objects which are included in many pages
  override val doInline = false

  override val typeEntitiesAsHtml = true
  override val compactFlags = true
  override val removeSimpleBodyDocs = true
  override val simpleParamsAsString = true

  case class Page(no: Int, main: Int) {
    val objects = new mutable.HashSet[Int]
    val renumbered = new mutable.ArrayBuffer[Int]
    lazy val renumberedMap = renumbered.zipWithIndex.toMap // don't access until "renumbered" is stable
  }

  def generate(universe: Universe): Unit = {
    if(explorer) {
      val p = "/com/novocode/extradoc/explorer"
      copyResource(p, "index.html")
      copyResource(p, "css/extradoc.css")
      copyResource(p, "js/extradoc.js")
      copyResource(p, "js/explorer.js")
      copyResource(p, "js/jquery-1.4.2.min.js")
      copyResource(p, "js/jquery-ui-1.8.5.custom.min.js")
      copyResource(p, "js/jquery.history.js")
      copyResource(p, "images/ajax-loader-white.gif")
    }

    val (allModels, _) = prepareModel(universe)

    aliasComments(allModels)

    val pages = findGlobal(allModels).toSeq.sorted.
      zipWithIndex map { case (ord,idx) => (ord, Page(idx, ord))} toMap;
    def findPage(ord: Int, j: JBase): Option[Page] = j match {
      case j: JObject =>
        val isPage = pages contains ord
        val isPackage = j("isPackage", false) || j("is", "").contains('p')
        def isObject = j("isObject", false) || j("is", "").contains('b')
        lazy val parent = j("inTemplate") collect { case Link(t) => allModels(t) }
        def parentIsTemplate = parent collect { case par: JObject =>
          par("isTemplate", false) || par("is", "").contains('M')
        } getOrElse false
        def isInParent = parent collect { case par: JObject =>
          (par("values", JArray.Empty).values ++ par("methods", JArray.Empty).values) contains Link(ord)
        } getOrElse false
        val companionPage = j("companion") map { case l: Link => pages get l.target }
        // Don't map external packages to their parents
        if(ord >= 0 && isPackage && !isPage) None
        // Map auto-generated case class companion objects without a separate page to their classes
        else if(isObject && companionPage.isDefined && !isPage) companionPage.get
        // Treat members which were remapped but not compacted away as extras
        else if((isDef(j) || isVal(j) || isAliasType(j)) && !isInParent && parentIsTemplate) None
        else j("inTemplate") match {
          case Some(Link(target)) =>
            pages get target orElse (allModels get target flatMap (ch => findPage(target, ch)))
          case Some(j: JObject) => findPage(-1, j)
          case None => None
        }
      case _ => None
    }
    var extra = new mutable.HashSet[Int]
    allModels foreach { case (ord, j) =>
      (pages get ord orElse findPage(ord, j) map (_.objects) getOrElse extra) += ord
    }

    println("Mapping "+extra.size+" extra objects to all pages that need them")
    var extraTotal = 0
    def mapExtras(p: Page, j: JBase) {
      j foreachRec {
        _.links foreach { l =>
          if(extra contains l.target) {
            if(!(p.objects contains l.target)) {
              extraTotal += 1
              p.objects += l.target
              mapExtras(p, allModels(l.target))
            }
          }
        }
      }
    }
    pages.values foreach { p =>
      p.objects map allModels foreach { j => mapExtras(p, j) }
    }
    println("Total number of extra objects on all pages: "+extraTotal)

    val keepHtmlLinks = new mutable.HashSet[Int]
    allModels.values foreach {
      _ foreachRec {
        _ match {
          case j: JObject =>
            j("_links") foreach {
              _.asInstanceOf[JArray].values foreach {
                keepHtmlLinks += _.asInstanceOf[Link].target
              }
            }
          case _ =>
        }
      }
    }

    println("Removing extra objects which are duplicated further up the linarization")
    var removedExtras = 0
    pages.values foreach { p =>
      allModels(p.main).asInstanceOf[JObject].apply("linearization", JArray.Empty).values foreach {
        case Link(l) if l != p.main =>
          pages get l foreach { p2 =>
            var s = p.objects.size
            p.objects --= (p2.objects intersect extra)
            removedExtras += s-p.objects.size
          }
        case _ =>
      }
    }
    println("Removed "+removedExtras+" extra objects")

    println("Inlining objects on all pages")
    var totalInlined = 0
    val counts = new mutable.HashMap[Int, Int]
    allModels.values foreach {
      _ foreachRec {
        _.links foreach { l =>
          val j = allModels(l.target).asInstanceOf[JObject]
          if((extra contains l.target) && !(keepHtmlLinks contains l.target) && !(isDef(j) || isVal(j)))
            counts += l.target -> (counts.getOrElse(l.target, 0) + 1)
        }
      }
    }
    for(p <- pages.values) {
      val toInline = (counts filter { case (_,c) => c <= 1 } keys).toSet
      if(!toInline.isEmpty) {
        totalInlined += toInline.size
        val repl = toInline map { i => (Link(i), allModels(i)) } toMap;
        p.objects --= toInline
        def replaceIn(j: JBase) {
          j replaceLinks repl
          j.children map { replaceIn _ }
        }
        allModels filter { case (ord, j) => p.objects contains ord } map { _._2 } foreach { replaceIn _ }
      }
    }
    println("Inlined "+totalInlined+" objects")

    println("Removing qualified names of defs, vals and alias types")
    allModels.values foreach {
      case j: JObject =>
        if(isDef(j) || isVal(j) || isAliasType(j)) {
          if(!j("name").isDefined && j("qName").isDefined) j += "name" -> qNameToName(j("qName", ""))
          j -= "qName"
        }
      case _ =>
    }

    val remappedIDs = new mutable.HashMap[Link, (Int, Int)]
    for(p <- pages.values) {
      p.renumbered += p.main
      remappedIDs += Link(p.main) -> (p.no, 0)
      for(ord <- p.objects if ord != p.main) {
        remappedIDs += Link(ord) -> (p.no, p.renumbered.size)
        p.renumbered += ord
      }
    }
    println("Writing p0.json to p"+(pages.size-1)+".json")
    val globalNames = new mutable.HashMap[String, String]
    def convertLink(p: Page)(l: Link) = {
      val localIdx: Option[Int] = p.renumberedMap get l.target
      val localOrParentIdx: Option[Any] = localIdx orElse {
        val lin = allModels(p.main).asInstanceOf[JObject].apply("linearization", JArray.Empty).values;
        val parentIdx = lin.toSeq.view flatMap {
          case Link(t2) =>
            pages get t2 flatMap { p2 => p2.renumberedMap get l.target map { (p2.no, _) } }
          case _ => None
        }
        parentIdx foreach { case (page, idx) =>
          //TODO Remove this block so that links that go up in the linearization are not added
          //to the global names index. This requires that the "Model" view in the explorer can
          //load the linearization and resolve the links there.
          if(idx == 0 || page != p.no) {
            val jo = allModels(l.target).asInstanceOf[JObject]
            jo("name") orElse { jo("qName") map { q => qNameToName(q.asInstanceOf[String]) } } foreach { case n: String =>
              globalNames += page+","+idx -> n
            }
          }
        }
        parentIdx map { case (page, idx) => JArray(Seq(page, idx)) } headOption
      }
      localOrParentIdx getOrElse {
        val (page, idx) = remappedIDs(l)
        if(idx == 0 || page != p.no) {
          val jo = allModels(l.target).asInstanceOf[JObject]
          jo("name") orElse { jo("qName") map { q => qNameToName(q.asInstanceOf[String]) } } foreach { case n: String =>
            globalNames += page+","+idx -> n
          }
        }
        JArray(Seq(page, idx))
      }
    }
    for(p <- pages.values) {
      JsonWriter(siteRoot, "p"+p.no+".json") createArray { w =>
        for(ord <- p.renumbered) w.write(allModels(ord), convertLink(p))
      }
    }

    val pageObjects = pages.values map { p => (p.no, (allModels(p.main).asInstanceOf[JObject], p.main)) }
    val allPackages = pageObjects filter { case (_, (j, _)) =>
      j("isPackage").getOrElse(false) == true || j("is").getOrElse("").asInstanceOf[String].contains('p')
    } toMap
    val linearPackages = allPackages.toSeq sortBy { case (_, (j, _)) => j("qName").get.asInstanceOf[String] }
    println("Writing global.json")
    val processedTemplates = new mutable.HashSet[Int]
    def processTemplates(jOrd: Int, j: JObject, jo: JObject) {
      j("templates") foreach { case a: JArray =>
        val children = a.values collect { case l: Link =>
          (l.target, allModels(l.target))
        } filter { case (_, j: JObject) =>
          val up = j("inTemplate") collect { case l: Link => l.target } getOrElse -1
          up == -1 || up == jOrd
        }
        val tlChildren = children map { case (ord, j: JObject) =>
          val is = j("is", "")
          val kind =
            if(j("isClass", false) || is.contains('c')) 'c'
            else if(j("isTrait", false) || is.contains('t')) 't'
            else if(j("isObject", false) || is.contains('b')) 'b'
            else '_'
          (ord, j, kind)
        } filter { case (ord, _, kind) => (pages contains ord) && (kind != '_') } toSeq;
        val sortedChildren = tlChildren sortBy { case (_, j: JObject, kind) =>
          (j("qName", "").toLowerCase, kind)
        }
        jo +?= "e" -> JArray(sortedChildren map { case (ord, chj, kind) =>
          val ch = new JObject
          ch += "p" -> pages(ord).no
          ch += "k" -> kind.toString
          if(!processedTemplates.contains(ord)) {
            processedTemplates += ord
            processTemplates(ord, chj, ch)
          }
          ch
        })
      }
    }
    JsonWriter(siteRoot, "global.json") createObject { w =>
      w.write("names", JObject(globalNames), { _.target })
      w.write("packages", JArray(linearPackages map { case (no, (j: JObject, ord)) =>
        val jo = new JObject
        jo += "p" -> no
        jo += "n" -> j("qName").get.asInstanceOf[String]
        j("inTemplate") foreach { case l: Link => jo += "in" -> pages(l.target).no }
        processTemplates(ord, j, jo)
        jo
      }), { _.target })
      val settings = new JObject
      if(!universe.settings.doctitle.isDefault) settings += "doctitle" -> universe.settings.doctitle.value
      if(!universe.settings.docversion.isDefault) settings += "docversion" -> universe.settings.docversion.value
      if(!universe.settings.docsourceurl.isDefault) settings += "docsourceurl" -> universe.settings.docsourceurl.value
      w.write("settings", settings, { _.target })
    }
  }

  def aliasComments(allModels: mutable.HashMap[Int, JBase]) {
    println("Aliasing repeated comments")
    def forMembers(j: JObject)(f: (JObject, Link) => Unit) {
      j("values", JArray.Empty).values ++ j("methods", JArray.Empty).values foreach {
        case l: Link => f(allModels(l.target).asInstanceOf[JObject], l)
        case _ =>
      }
    }
    def findComment(c: JObject, templates: List[Link], notIn: Link): Option[Link] = templates match {
      case t :: ts => findComment(c, ts, notIn) orElse {
        var found: Option[Link] = None
        forMembers(allModels(t.target).asInstanceOf[JObject]) { (member, memberLink) =>
          if(memberLink != notIn) {
            member("comment") foreach {
              case mc: JObject =>
                if(!found.isDefined && mc == c) found = Some(memberLink)
              case _ =>
            }
          }
        }
        found
      }
      case Nil => None
    }
    var count = 0
    allModels foreach {
      case (idx, j: JObject) =>
        val lin = (Link(idx) :: j("linearization", JArray.Empty).values.toList).asInstanceOf[List[Link]]
        forMembers(j) { (member, memberLink) =>
          var found: Option[Link] = None
          member("comment") foreach {
            case c: JObject =>
              findComment(c, lin, memberLink) foreach { l => found = Some(l) }
            case _ =>
          }
          found foreach { l =>
            member += "commentIn" -> l
            member -= "comment"
            count += 1
          }
        }
      case _ =>
    }
    println("Aliased "+count+" comments")
  }

  def isDef(j: JObject) = j("isDef", false) || j("is", "").contains('d')
  def isVal(j: JObject) = j("isVal", false) || j("is", "").contains('v') || j("isLazyVal", false) || j("is", "").contains('l')
  def isAliasType(j: JObject) = j("isAliasType", false) || j("is", "").contains('a')
}
