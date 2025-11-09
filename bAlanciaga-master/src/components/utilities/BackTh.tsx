import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const BackTh: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  var grid = new THREE.GridHelper(10, 20, "red", "blue");
  useEffect(() => {

    // Create a scene
    const scene = new THREE.Scene();
    // Create a camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    // Create a renderer
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth * 0.4, window.innerWidth *  0.2);
    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    scene.add(grid);

    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);

    // Animation loop
    const animate = (): void => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Clean up on component unmount
    return () => {
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      controls.dispose(); // Dispose of controls when unmounting
    };
  }, []);

  return <div ref={mountRef} />;
};

export default BackTh;