ExtraDoc

An extended version of Scala's scaladoc command. It has all the features (and
the command line syntax) of the original scaladoc, plus:

- Generate documentation in a single JSON file with a format resembling the
  structure of the scala.tools.nsc.doc.model.* classes (-doc-format:json)

- Instead of only Scala source files you can also specify directories on the
  command line to include all *.scala files inside (recursively)

See LICENSE.txt for licensing conditions (BSD-style).
