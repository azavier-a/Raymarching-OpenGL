# OpenGL Raymarching
> If you wish to modify the code to make your own shader, screen.frag will be of most interest to you. Roughness is not yet implemented. Neither are shadows.
<details>
<summary>Steps</summary>

> Open the file in an editor

> The SceneDistance function is where the scene is built. By default, there are examples of rotations and translations. Some distance functions are provided.

> Materials can be custom made by simply making more material structs in the materials array. When applying a material, they are 1-indexed. the first material has index 1.

> Material constructor: Material(vec3 albedo, float roughness, float metallicity, float emissive)

> The position and focus of the camera is handled at the top of the PixelColor function

> You can add lights by appending more onto the pointLights array.

> Light constructor: PointLight(vec3 position, vec4 color, float radius)

> 4th component of color is intensity, radius is the reach of the light.
</details>

Controls:
|Key |Time multiplier |
|----|----------------|
|1   |-2x             |
|2   |-1x             |
|3   |1x              |
|4   |2x              |
|W   |0x              |