
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include "Window.h"

int main() {
	if (!glfwInit()) {
		return -1;
	}

	GLTemplate::Window* window = new GLTemplate::Window(1600, 900, "OpenGL Template");


	// Game Loop
	while (window->IsOpen()) {
		
		window->Clear(vec3{0.0f});
		
		window->Update();
	}

	delete window;
}