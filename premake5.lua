-- premake5.lua
workspace "Raymarching"
   architecture "x64"
   configurations { "Debug", "Release", "Dist" }
   startproject "Raymarching"

outputdir = "%{cfg.buildcfg}-%{cfg.system}-%{cfg.architecture}"

group "Dependancies" 
	include "/vendor/GLFW"
group ""
	include "Raymarching"