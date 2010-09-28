ExtraDoc

An extended version of Scala's scaladoc command. It has all the features (and
the command line syntax) of the original scaladoc, plus:

- Generate documentation in a single JSON file with a format resembling the
  structure of the scala.tools.nsc.doc.model.* classes (-doc-format:json)

- Instead of only Scala source files you can also specify directories on the
  command line to include all *.scala files inside (recursively)

Usage: There's a bin/extradoc.bat script for Windows that can be used after
building the project with "sbt compile". Make sure that the "scala" command
from Scala 2.8.0 is on your path. Or run the main class
com.novocode.extradoc.ExtraDoc in some other way.

Example: Building scaladoc.json for the Scala library (run from the base dir
of the Scala source code):
  extradoc -doc-format:json -P:continuations:enable src\actors src\library\scala src\swing src\continuations\library

For Scala 2.8.0, this results in a JSON file of 111 MB which compresses very
nicely to less than 5.5 MB (with 7zip).

See LICENSE.txt for licensing conditions (BSD-style).
