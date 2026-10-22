import { t } from './i18n/core.mjs';
import { useLanguage } from './i18n/Language';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { feature } from 'topojson-client';
const position = (lat, lon, r = 2) => {
  const a = (lat * Math.PI) / 180;
  const b = (lon * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.cos(a) * Math.cos(b),
    r * Math.sin(a),
    -r * Math.cos(a) * Math.sin(b)
  );
};
export default function Globe({
  records,
  onSelect,
  rotating,
  zoom,
  focusLatitude,
  focusLongitude,
}) {
  useLanguage();
  const mount = useRef();
  const api = useRef();
  const callback = useRef(onSelect);
  callback.current = onSelect;
  useEffect(() => {
    const el = mount.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
    } catch (e) {
      el.dataset.webglError = 'true';
      el.innerText = t(
        'Seu navegador não disponibilizou WebGL. Consulte os locais na tabela abaixo.'
      );
      return;
    }
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 7.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 4.7;
    controls.maxDistance = 11;
    controls.autoRotateSpeed = 0.45;
    const earth = new THREE.Group();
    earth.rotation.y = -1.2;
    scene.add(earth);
    let disposed = false;
    const textures = [];
    const loader = new THREE.TextureLoader();
    const texture = (name) => {
      const t = loader.load(
        '/textures/' + name,
        () => {
          if (disposed) t.dispose();
        },
        undefined,
        () => {
          if (!disposed) el.dataset.textureError = 'true';
        }
      );
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      textures.push(t);
      return t;
    };
    const surface = texture('earth_atmos_2048.jpg');
    surface.encoding = THREE.sRGBEncoding;
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2, 96, 96),
      new THREE.MeshPhongMaterial({
        map: surface,
        normalMap: texture('earth_normal_2048.jpg'),
        normalScale: new THREE.Vector2(0.45, 0.45),
        specularMap: texture('earth_specular_2048.jpg'),
        specular: 0x667d94,
        shininess: 20,
      })
    );
    earth.add(earthMesh);
    const cloudTexture = texture('earth_clouds_1024.png');
    cloudTexture.encoding = THREE.sRGBEncoding;
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(2.018, 80, 80),
      new THREE.MeshPhongMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        shininess: 0,
      })
    );
    earth.add(clouds);
    scene.add(new THREE.AmbientLight(0xb0c8ee, 0.6));
    const light = new THREE.DirectionalLight(0xfff6e8, 1.8);
    light.position.set(-4, 3, 6);
    scene.add(light);
    const fill = new THREE.DirectionalLight(0x3888ee, 0.25);
    fill.position.set(4, -1, -4);
    scene.add(fill);
    const starPositions = [];
    let seed = 17;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 450; i++) {
      const z = random() * 2 - 1;
      const a = random() * Math.PI * 2;
      const r = 22;
      starPositions.push(
        r * Math.sqrt(1 - z * z) * Math.cos(a),
        r * z,
        r * Math.sqrt(1 - z * z) * Math.sin(a)
      );
    }
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.Float32BufferAttribute(starPositions, 3)
      ),
      new THREE.PointsMaterial({
        color: 0x91b8dc,
        size: 0.025,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
    );
    scene.add(stars);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x18617a,
      transparent: true,
      opacity: 0.055,
    });
    for (let lat = -75; lat <= 75; lat += 15)
      earth.add(
        new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(
            Array.from(
              {
                length: 181,
              },
              (_, i) => position(lat, i * 2, 2.005)
            )
          ),
          lineMaterial
        )
      );
    for (let lon = 0; lon < 360; lon += 15)
      earth.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(
            Array.from(
              {
                length: 181,
              },
              (_, i) => position(i - 90, lon, 2.005)
            )
          ),
          lineMaterial
        )
      );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(2.07, 64, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        uniforms: {},
        vertexShader:
          'varying vec3 n; varying vec3 v; void main(){n=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
        fragmentShader:
          'varying vec3 n; varying vec3 v; void main(){float a=pow(1.-abs(dot(n,v)),3.);gl_FragColor=vec4(.08,.7,1.,a*.65);}',
      })
    );
    earth.add(glow);
    fetch('/countries-110m.json')
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (disposed) return;
        const borders = new THREE.Group();
        feature(data, data.objects.countries).features.forEach((f) => {
          const polys =
            f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
          polys.forEach((poly) =>
            poly.forEach((ring) =>
              borders.add(
                new THREE.Line(
                  new THREE.BufferGeometry().setFromPoints(
                    ring.map(([lon, lat]) => position(lat, lon, 2.025))
                  ),
                  new THREE.LineBasicMaterial({
                    color: 0x39acc4,
                    transparent: true,
                    opacity: 0.18,
                  })
                )
              )
            )
          );
        });
        earth.add(borders);
      })
      .catch(() => {});
    const markers = new THREE.Group();
    earth.add(markers);
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let start;
    const down = (e) => {
      start = [e.clientX, e.clientY];
    };
    const click = (e) => {
      if (!start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 5) return;
      const b = el.getBoundingClientRect();
      pointer.set(
        ((e.clientX - b.left) / b.width) * 2 - 1,
        (-(e.clientY - b.top) / b.height) * 2 + 1
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(markers.children).find((h) => h.object.userData.record);
      if (hit) {
        const world = hit.object.getWorldPosition(new THREE.Vector3());
        const normal = world.clone().normalize();
        if (normal.dot(camera.position.clone().sub(world)) > 0)
          callback.current(hit.object.userData.record);
      }
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', click);
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    api.current = {
      markers,
      earth,
      controls,
      camera,
    };
    let frame;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      clouds.rotation.y += 0.00007;
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      el.replaceChildren();
      api.current = null;
    };
  }, []);
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    while (a.markers.children.length) {
      const m = a.markers.children[0];
      a.markers.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    records.forEach((r) => {
      const size = 0.025 + Math.min(0.045, Math.log10(r.cases + 1) * 0.008);
      const p = position(r.latitude, r.longitude, 2.06);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(size, 12, 12),
        new THREE.MeshBasicMaterial({
          color: 0xff5269,
        })
      );
      dot.position.copy(p);
      dot.userData.record = r;
      a.markers.add(dot);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(size * 1.6, size * 2.05, 32),
        new THREE.MeshBasicMaterial({
          color: 0xff5269,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        })
      );
      ring.position.copy(p);
      ring.lookAt(p.clone().multiplyScalar(2));
      ring.userData.record = r;
      a.markers.add(ring);
    });
  }, [records]);
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    if (Number.isFinite(focusLatitude) && Number.isFinite(focusLongitude)) {
      a.earth.updateMatrixWorld(true);
      const target = a.earth.localToWorld(position(focusLatitude, focusLongitude));
      a.camera.position.copy(target.normalize().multiplyScalar(7.6 / (zoom || 1)));
    } else a.camera.position.set(0, 0, 7.6 / (zoom || 1));
    a.controls.update();
  }, [focusLatitude, focusLongitude]);
  useEffect(() => {
    if (api.current) api.current.controls.autoRotate = rotating;
  }, [rotating]);
  useEffect(() => {
    if (api.current) {
      api.current.camera.position.setLength(7.6 / zoom);
      api.current.controls.update();
    }
  }, [zoom]);
  useEffect(() => {
    if (mount.current?.dataset.webglError)
      mount.current.innerText = t(
        'Seu navegador não disponibilizou WebGL. Consulte os locais na tabela abaixo.'
      );
  });
  return (
    <div
      className="globe-canvas"
      ref={mount}
      aria-label={t(
        'Globo interativo: arraste para girar, use a roda para aproximar e clique nos pontos para consultar locais'
      )}
    />
  );
}
