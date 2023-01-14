-- premake5.lua
workspace "OpenGLApp"
   architecture "x64"
   configurations { "Debug", "Release", "Dist" }
   startproject "OpenGLApp"

outputdir = "%{cfg.buildcfg}-%{cfg.system}-%{cfg.architecture}"

group "Dependancies" 
	include "/vendor/GLFW"
group ""

include "OpenGLApp"