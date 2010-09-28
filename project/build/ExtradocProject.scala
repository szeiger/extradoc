import sbt._

class ExtradocProject(info: ProjectInfo) extends DefaultProject(info)
{
  override def compileOptions = Deprecation :: super.compileOptions.toList
}
