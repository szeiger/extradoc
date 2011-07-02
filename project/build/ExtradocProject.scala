import java.io.File
import sbt._

class ExtradocProject(info: ProjectInfo) extends DefaultProject(info)
{
  /*********** Options ***********/
  override def compileOptions = Deprecation :: super.compileOptions.toList
  override def documentOptions: Seq[ScaladocOption] = documentTitle("Extradoc " + version) :: Nil

  /*********** Publishing ***********/
  val publishTo = Resolver.file("Test Repo", new File("d:/temp/repo/"))
  //val publishTo = "Scala Tools Snapshots" at "http://nexus.scala-tools.org/content/repositories/snapshots/"
  //val publishTo = "Scala Tools Releases" at "http://nexus.scala-tools.org/content/repositories/releases/"
  Credentials(Path.userHome / ".ivy2" / ".credentials", log)
  //override def deliverScalaDependencies = Nil
  override def managedStyle = ManagedStyle.Maven
  override def packageDocsJar = defaultJarPath("-javadocs.jar")
  override def packageSrcJar = defaultJarPath("-sources.jar")
  val sourceArtifact = Artifact(artifactID, "src", "jar", Some("sources"), Nil, None)
  val docsArtifact = Artifact(artifactID, "docs", "jar", Some("javadocs"), Nil, None)
  override def packageToPublishActions = super.packageToPublishActions ++ Seq(/*packageDocs,*/ packageSrc)

  /*********** Extra meta-data for the POM ***********/
  override def pomExtra =
    (<name>Extradoc</name>
    <url>https://github.com/szeiger/extradoc/</url>
    <inceptionYear>2010</inceptionYear>
    <description>A type-safe database API for Scala</description>
    <licenses>
      <license>
        <name>Two-clause BSD-style license</name>
        <url>https://github.com/szeiger/extradoc/blob/master/LICENSE.txt</url>
        <distribution>repo</distribution>
      </license>
    </licenses>
    <developers>
      <developer>
        <id>szeiger</id>
        <name>Stefan Zeiger</name>
        <timezone>+1</timezone>
        <email>szeiger [at] novocode.com</email>
      </developer>
    </developers>
    <scm>
      <url>http://github.com/szeiger/extradoc/</url>
    </scm>)
}
