#include "Raymarching.h"
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <fstream>
#include <vector>
#include <sstream>
#include <stdio.h>
#include <windows.h>
#include <glm/matrix.hpp>
#include <iostream>

#define EXIT_FAIL() return -1
#define ASSERT_PAUSE() if (pause != NULL) { epoch += (currentTimeMillis() - pause); pause = NULL; }

#define SPEED 12.
#define CAMX_SPEED 150
#define CAMY_SPEED 40

#define PI 3.141592
#define TAU 6.283184

/******||UTILS||******/

__int64 currentTimeMillis() {
	FILETIME f;
	GetSystemTimeAsFileTime(&f);
	(long long)f.dwHighDateTime;
	__int64 nano = ((__int64)f.dwHighDateTime << 32LL) + (__int64)f.dwLowDateTime;
	return (nano - 116444736000000000LL) / 10000;
}
inline double random_double() {
	// Returns a random real in [0,1).
	return rand() / (RAND_MAX + 1.0);
}
inline double random_double(double min, double max) {
	// Returns a random real in [min,max).
	return min + (max - min) * random_double();
}
GLuint LoadShaders(const char* vertex_file_path, const char* fragment_file_path) {

	// Create the shaders
	GLuint VertexShaderID = glCreateShader(GL_VERTEX_SHADER);
	GLuint FragmentShaderID = glCreateShader(GL_FRAGMENT_SHADER);

	// Read the Vertex Shader code from the file
	std::string VertexShaderCode;
	std::ifstream VertexShaderStream(vertex_file_path, std::ios::in);
	if (VertexShaderStream.is_open()) {
		std::stringstream sstr;
		sstr << VertexShaderStream.rdbuf();
		VertexShaderCode = sstr.str();
		VertexShaderStream.close();
	}
	else {
		printf("Impossible to open %s. Are you in the right directory ? Don't forget to read the FAQ !\n", vertex_file_path);
		getchar();
		return 0;
	}

	// Read the Fragment Shader code from the file
	std::string FragmentShaderCode;
	std::ifstream FragmentShaderStream(fragment_file_path, std::ios::in);
	if (FragmentShaderStream.is_open()) {
		std::stringstream sstr;
		sstr << FragmentShaderStream.rdbuf();
		FragmentShaderCode = sstr.str();
		FragmentShaderStream.close();
	}

	GLint Result = GL_FALSE;
	int InfoLogLength;

	// Compile Vertex Shader
	printf("Compiling shader : %s\n", vertex_file_path);
	char const* VertexSourcePointer = VertexShaderCode.c_str();
	glShaderSource(VertexShaderID, 1, &VertexSourcePointer, NULL);
	glCompileShader(VertexShaderID);

	// Check Vertex Shader
	glGetShaderiv(VertexShaderID, GL_COMPILE_STATUS, &Result);
	glGetShaderiv(VertexShaderID, GL_INFO_LOG_LENGTH, &InfoLogLength);
	if (InfoLogLength > 0) {
		std::vector<char> VertexShaderErrorMessage(InfoLogLength + 1);
		glGetShaderInfoLog(VertexShaderID, InfoLogLength, NULL, &VertexShaderErrorMessage[0]);
		printf("%s\n", &VertexShaderErrorMessage[0]);
	}

	// Compile Fragment Shader
	printf("Compiling shader : %s\n", fragment_file_path);
	char const* FragmentSourcePointer = FragmentShaderCode.c_str();
	glShaderSource(FragmentShaderID, 1, &FragmentSourcePointer, NULL);
	glCompileShader(FragmentShaderID);

	// Check Fragment Shader
	glGetShaderiv(FragmentShaderID, GL_COMPILE_STATUS, &Result);
	glGetShaderiv(FragmentShaderID, GL_INFO_LOG_LENGTH, &InfoLogLength);
	if (InfoLogLength > 0) {
		std::vector<char> FragmentShaderErrorMessage(InfoLogLength + 1);
		glGetShaderInfoLog(FragmentShaderID, InfoLogLength, NULL, &FragmentShaderErrorMessage[0]);
		printf("%s\n", &FragmentShaderErrorMessage[0]);
	}

	// Link the program
	printf("Linking program\n");
	GLuint ProgramID = glCreateProgram();
	glAttachShader(ProgramID, VertexShaderID);
	glAttachShader(ProgramID, FragmentShaderID);
	glLinkProgram(ProgramID);

	// Check the program
	glGetProgramiv(ProgramID, GL_LINK_STATUS, &Result);
	glGetProgramiv(ProgramID, GL_INFO_LOG_LENGTH, &InfoLogLength);
	if (InfoLogLength > 0) {
		std::vector<char> ProgramErrorMessage(InfoLogLength + 1);
		glGetProgramInfoLog(ProgramID, InfoLogLength, NULL, &ProgramErrorMessage[0]);
		printf("%s\n", &ProgramErrorMessage[0]);
	}

	glDetachShader(ProgramID, VertexShaderID);
	glDetachShader(ProgramID, FragmentShaderID);

	glDeleteShader(VertexShaderID);
	glDeleteShader(FragmentShaderID);

	return ProgramID;
}

/******||MAIN||******/
int GLFW_INIT() {
	if (!glfwInit())
		EXIT_FAIL();

	glfwWindowHint(GLFW_SAMPLES, 1); // antialiasing
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3); // OpenGL 3.3
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
	glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE); // To make MacOS happy
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
	return 0;
}
GLFWwindow* createWindow(int wid, int hei, const char* name) {
	GLFWwindow* win = glfwCreateWindow(wid, hei, name, NULL, NULL);
	if (win == NULL) {
		glfwTerminate();
		return NULL;
	}
	glfwMakeContextCurrent(win);
	if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
		return NULL;
	}
	return win;
}
void genVAsVBs(GLuint* VAID, GLuint* VB) {
	static const float vertex_buffer_data[] = {
		-1.0f, 1.0f,
		1.0f, 1.0f,
		1.0f, -1.0f,
		1.0f, -1.0f,
		-1.0f, -1.0f,
		-1.0f, 1.0f
	};
	glGenVertexArrays(1, VAID);
	glBindVertexArray(*VAID);

	glGenBuffers(1, VB);
	glBindBuffer(GL_ARRAY_BUFFER, *VB);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertex_buffer_data), vertex_buffer_data, GL_STATIC_DRAW);
}

int scroll = 1;
long long pause = NULL;
auto epoch = currentTimeMillis();

glm::vec3 FWD = { 0.0f, 0.0f, 1.0f };
glm::vec3 UP = { 0.0f, 1.0f, 0.0f };
glm::vec3 RGT = { 1.0f, 0.0f, 0.0f };

// A X B = (a[1]b[2]-a[2]b[1])(x) + (a[2]b[0]-a[0]b[2])(y) + (a[0]b[1]-a[1]b[0])(z)

// RGT = UP X FWD = -(FWD X UP)

glm::vec3 ro = { 0.0f, 0.0f, -8.0f };
glm::vec3 fwd = { 0.0f, 0.0f, 1.0f };
glm::vec3 rgt = { 1.0f, 0.0f, 0.0f };

void timeFlow() {
	switch (scroll) {
		case -2:
			epoch += 25;
			break;
		case -1:
			epoch += 10;
			break;
		case 0:
		case 1:
			break;
		case 2:
			epoch -= 10;
			break;
	}
}
void input(GLFWwindow* window, float dT) {
	// TIME
	if (glfwGetKey(window, GLFW_KEY_2) == GLFW_PRESS) {
		ASSERT_PAUSE();
		scroll = -2;
	}
	else if (glfwGetKey(window, GLFW_KEY_3) == GLFW_PRESS) {
		ASSERT_PAUSE();
		scroll = -1;
	}
	else if (glfwGetKey(window, GLFW_KEY_E) == GLFW_PRESS && pause == NULL) {
		pause = currentTimeMillis();
		scroll = 0;
	}
	else if (glfwGetKey(window, GLFW_KEY_4) == GLFW_PRESS) {
		ASSERT_PAUSE();
		scroll = 1;
	}
	else if (glfwGetKey(window, GLFW_KEY_5) == GLFW_PRESS) {
		ASSERT_PAUSE();
		scroll = 2;
	}
	// CAMERA
	
	glm::vec3 up = glm::cross(fwd, rgt);

	float sp = SPEED * dT, cx = CAMX_SPEED * dT, cy = CAMY_SPEED * dT * 0.05f;

	if (glfwGetKey(window, GLFW_KEY_LEFT_ALT) == GLFW_PRESS) {
		sp *= 0.25;
		cx *= 0.25;
		cy *= 0.25;
	}

	if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
		ro += rgt * sp;
	else if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
		ro -= rgt * sp;

	if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
		ro += fwd * sp;
	else if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
		ro -= fwd * sp;

	if (glfwGetKey(window, GLFW_KEY_SPACE) == GLFW_PRESS)
		ro += up * sp;
	else if (glfwGetKey(window, GLFW_KEY_LEFT_SHIFT) == GLFW_PRESS)
		ro -= up * sp;


	float dx = PI / 512.0f;
	if(glfwGetKey(window, GLFW_KEY_UP) == GLFW_PRESS) {
		float c = std::cos(dx), s = std::sin(dx);
		fwd += glm::vec3(0.0f, c, -s)*cy;
	} else if(glfwGetKey(window, GLFW_KEY_DOWN) == GLFW_PRESS) {
		float c = std::cos(dx), s = std::sin(dx);
		fwd += glm::vec3(0.0f, -c, s)*cy;
	}

	dx = PI / 264.0f;
	dx *= cx;
	if(glfwGetKey(window, GLFW_KEY_RIGHT) == GLFW_PRESS) {
		float c = std::cos(dx), s = std::sin(dx);
		glm::mat3x3 mat { c, 0.0f, -s, 0.0f, 1.0f, 0.0f, s, 0.0f, c };
		fwd = mat * fwd;
		rgt = mat * rgt;
	} else if(glfwGetKey(window, GLFW_KEY_LEFT) == GLFW_PRESS) {
		float c = std::cos(dx), s = std::sin(dx);
		glm::mat3x3 mat { c, 0.0f, s, 0.0f, 1.0f, 0.0f, -s, 0.0f, c };
		fwd = mat * fwd;
		rgt = mat * rgt;
	}

	fwd = glm::normalize(fwd);
	rgt = glm::normalize(rgt);

	//std::cout << "(" << up.x << ", " << up.y << ", " << up.z << ") " << "(" << rgt.x << ", " << rgt.y << ", " << rgt.z << ")";
	//system("cls");
}
int main() {

	// WINDOW INIT

	if(GLFW_INIT() == -1)
		EXIT_FAIL();
	
	GLFWwindow* window = createWindow(1080, 720, "Ray Marching");
	if(window == NULL)
		EXIT_FAIL();
	
	glfwSetInputMode(window, GLFW_STICKY_KEYS, GL_TRUE);

	// VERTEX ARRAY/BUFFER

	unsigned int VAID;
	unsigned int vertexbuffer;

	genVAsVBs(&VAID, &vertexbuffer);

	// INITIALIZATION

	std::vector<int> resolution = { 0, 0 };

	unsigned int screen = LoadShaders("screen.vert", "screen.frag");
	glUseProgram(screen);
	
	auto launch = currentTimeMillis();
	int time;

	// MAIN LOOP
	long long last = currentTimeMillis(), cur;
	float dT;
	do {
		// deltaTime calculations.
		cur = currentTimeMillis();
		dT = 0.001f * (cur - last);
		last = cur;
		
		glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
		
		// INPUT SECTION
		input(window, dT);

		// TIME MANIPULATION (???)
		timeFlow(); // changes the 'epoch' which is the time my program thinks it started. if you add/subtract small amounts repeatedly, it simulates the motion through time.
		if(scroll != 0) time = int(currentTimeMillis() - epoch);

		// UNIFORMS
		glUniform1f(-1, (float)random_double(0, 10000000)); // PUSH RANDOM SEED

		glUniform3f(0, ro[0], ro[1], ro[2]); // PUSH CAMERA
		glUniform3f(1, ro[0]+fwd[0], ro[1]+fwd[1], ro[2]+fwd[2]); // PUSH FOCUS

		glUniform1i(3, time); // PUSH TIME
		
		glfwGetWindowSize(window, &resolution[0], &resolution[1]); // GET RESOLUTION);
		glUniform2f(2, resolution[0], resolution[1]); // PUSH RESOLUTION
		
		// DRAWING THE SQUARE
		glEnableVertexAttribArray(0);
		glBindBuffer(GL_ARRAY_BUFFER, vertexbuffer);
		glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 0, (void*)0);

		glDrawArrays(GL_TRIANGLES, 0, 6);
		glDisableVertexAttribArray(0);

		glfwSwapBuffers(window);
		glfwPollEvents();
	} while( (glfwGetKey(window, GLFW_KEY_ESCAPE) != GLFW_PRESS) && (glfwWindowShouldClose(window) == 0) );

	glfwTerminate();
	EXIT_SUCCESS();
}