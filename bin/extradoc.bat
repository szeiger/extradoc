@echo off

set _EXTRADOC_HOME=%~dps0..
set _TOOL_CLASSPATH=%_EXTRADOC_HOME%\target\scala_2.8.0\classes
set _ARGS=%*

set JAVA_OPTS=-Xms512M -Xmx2048M -Xss1M -XX:MaxPermSize=128M

scala -classpath %_TOOL_CLASSPATH% com.novocode.extradoc.ExtraDoc %_ARGS%
