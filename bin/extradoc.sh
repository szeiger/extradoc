#!/bin/sh

_SCRIPT_PATH="$(cd "${0%/*}" 2>/dev/null; echo "$PWD"/"${0##*/}")"
_SCRIPT_DIR=`dirname "${_SCRIPT_PATH}"}`
_EXTRADOC_HOME=${_SCRIPT_DIR}/..

export TOOL_CLASSPATH="${_EXTRADOC_HOME}/target/scala_2.8.0/classes:${_EXTRADOC_HOME}/src/main/resources"
export JAVA_OPTS="-Xms512M -Xmx2048M -Xss1M -XX:MaxPermSize=128M"

scala -classpath ${TOOL_CLASSPATH} com.novocode.extradoc.ExtraDoc "$@"
