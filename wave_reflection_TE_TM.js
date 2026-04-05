window.onload = function () {
    const container = document.querySelector('#canvas-container');
    const scene = new THREE.Scene();
    
    // Camera
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Bring camera closer and angle it to see the water ripples clearly
    camera.position.set(-8, 5, 16);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x0f172a, 1);
    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, -2, 0);
    controls.autoRotateSpeed = 1.5;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Materials
    const teMaterial = new THREE.LineBasicMaterial({ color: 0xf87171, linewidth: 2 });
    const tmMaterial = new THREE.LineBasicMaterial({ color: 0x818cf8, linewidth: 2 });
    const rayMaterial = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.2, gapSize: 0.1, opacity: 0.3, transparent: true });

    // Interface Material (y = 0)
    const surfaceMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transmission: 0.9,
        opacity: 1,
        metalness: 0,
        roughness: 0.1,
        ior: 1.52,
        transparent: true,
        side: THREE.FrontSide
    });
    
    // Single volume with high resolution top for ripples
    const surfaceGeometry = new THREE.BoxGeometry(30, 10, 10, 60, 1, 20);
    const surfaceMesh = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
    // Align top face to y=0 exactly
    surfaceMesh.position.y = -5.0;
    scene.add(surfaceMesh);
    
    // Original positions to ripple from
    const originalPositions = surfaceGeometry.attributes.position.clone();
    
    // Grid Helper at y=0
    const gridHelper = new THREE.GridHelper(30, 30, 0x38bdf8, 0x475569);
    gridHelper.position.y = 0;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Wave parameters
    let n1 = 1.0;
    let n2 = 1.5;
    const L = 10; // Length of rays
    const numPoints = 200;
    let lambda = 2.5; // Wavelength
    let k = (2 * Math.PI) / lambda;
    const w = 5; // Angular frequency

    // State Variables
    let time = 0;
    let incidentAngle = 45 * Math.PI / 180;
    let r_TE = 0, r_TM = 0, t_TE = 0, t_TM = 0;
    let theta_t = 0;

    // Arrays to hold envelope line arrays
    const incTePos = new Float32Array(numPoints * 3);
    const incTmPos = new Float32Array(numPoints * 3);
    const refTePos = new Float32Array(numPoints * 3);
    const refTmPos = new Float32Array(numPoints * 3);
    const transTePos = new Float32Array(numPoints * 3);
    const transTmPos = new Float32Array(numPoints * 3);

    // Arrays to hold ribbon meshes
    const ribbonPointCount = numPoints;
    const incTeRibbonPos = new Float32Array(ribbonPointCount * 2 * 3);
    const incTmRibbonPos = new Float32Array(ribbonPointCount * 2 * 3);
    const refTeRibbonPos = new Float32Array(ribbonPointCount * 2 * 3);
    const refTmRibbonPos = new Float32Array(ribbonPointCount * 2 * 3);
    const transTeRibbonPos = new Float32Array(ribbonPointCount * 2 * 3);
    const transTmRibbonPos = new Float32Array(ribbonPointCount * 2 * 3);

    const ribbonIndices = new Uint16Array((ribbonPointCount - 1) * 6);
    let r_idx = 0;
    for(let i=0; i < ribbonPointCount-1; i++) {
        const v0 = i*2;
        const v1 = i*2 + 1;
        const v2 = (i+1)*2;
        const v3 = (i+1)*2 + 1;
        ribbonIndices[r_idx++] = v0; ribbonIndices[r_idx++] = v1; ribbonIndices[r_idx++] = v2;
        ribbonIndices[r_idx++] = v1; ribbonIndices[r_idx++] = v3; ribbonIndices[r_idx++] = v2;
    }

    // Geometries
    const makeGeo = (pos) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        return geo;
    };

    const makeRibbonGeo = (pos) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setIndex(new THREE.BufferAttribute(ribbonIndices, 1));
        return geo;
    };

    const incTeGeo = makeGeo(incTePos);
    const incTmGeo = makeGeo(incTmPos);
    const refTeGeo = makeGeo(refTePos);
    const refTmGeo = makeGeo(refTmPos);
    const transTeGeo = makeGeo(transTePos);
    const transTmGeo = makeGeo(transTmPos);
    
    const incTeRibbonGeo = makeRibbonGeo(incTeRibbonPos);
    const incTmRibbonGeo = makeRibbonGeo(incTmRibbonPos);
    const refTeRibbonGeo = makeRibbonGeo(refTeRibbonPos);
    const refTmRibbonGeo = makeRibbonGeo(refTmRibbonPos);
    const transTeRibbonGeo = makeRibbonGeo(transTeRibbonPos);
    const transTmRibbonGeo = makeRibbonGeo(transTmRibbonPos);

    // Meshes
    const incTeLine = new THREE.Line(incTeGeo, teMaterial);
    const incTmLine = new THREE.Line(incTmGeo, tmMaterial);
    const refTeLine = new THREE.Line(refTeGeo, teMaterial);
    const refTmLine = new THREE.Line(refTmGeo, tmMaterial);
    const transTeLine = new THREE.Line(transTeGeo, teMaterial);
    const transTmLine = new THREE.Line(transTmGeo, tmMaterial);

    const teRibbonMat = new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    const tmRibbonMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });

    const incTeRibbon = new THREE.Mesh(incTeRibbonGeo, teRibbonMat);
    const incTmRibbon = new THREE.Mesh(incTmRibbonGeo, tmRibbonMat);
    const refTeRibbon = new THREE.Mesh(refTeRibbonGeo, teRibbonMat);
    const refTmRibbon = new THREE.Mesh(refTmRibbonGeo, tmRibbonMat);
    const transTeRibbon = new THREE.Mesh(transTeRibbonGeo, teRibbonMat);
    const transTmRibbon = new THREE.Mesh(transTmRibbonGeo, tmRibbonMat);

    scene.add(incTeLine, incTmLine, refTeLine, refTmLine, transTeLine, transTmLine);
    scene.add(incTeRibbon, incTmRibbon, refTeRibbon, refTmRibbon, transTeRibbon, transTmRibbon);

    // Support ray lines (solid baseline)
    const solidRayMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.6, transparent: true });
    const incRayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const refRayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const transRayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const incRayLine = new THREE.Line(incRayGeo, solidRayMaterial);
    const refRayLine = new THREE.Line(refRayGeo, solidRayMaterial);
    const transRayLine = new THREE.Line(transRayGeo, solidRayMaterial);
    scene.add(incRayLine, refRayLine, transRayLine);

    // Group elements for toggling
    const teObjects = [incTeLine, refTeLine, transTeLine, incTeRibbon, refTeRibbon, transTeRibbon];
    const tmObjects = [incTmLine, refTmLine, transTmLine, incTmRibbon, refTmRibbon, transTmRibbon];

    const normalGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -L, 0), new THREE.Vector3(0, L, 0)]);
    const normalLine = new THREE.Line(normalGeo, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.4, gapSize: 0.2, opacity: 0.5, transparent: true }));
    normalLine.computeLineDistances();
    scene.add(normalLine);

    // UI Elements
    const slider = document.getElementById("incidentAngle");
    const angleValue = document.getElementById("angleValue");
    const rTeValue = document.getElementById("rTeValue");
    const rTmValue = document.getElementById("rTmValue");

    const n1Slider = document.getElementById("n1Slider");
    const n2Slider = document.getElementById("n2Slider");
    const lambdaSlider = document.getElementById("lambdaSlider");
    const angleTickMarks = document.getElementById("angleTickMarks");

    function updatePhysics() {
        const theta_i = parseFloat(slider.value) * Math.PI / 180;
        incidentAngle = theta_i;
        angleValue.innerHTML = parseFloat(slider.value).toFixed(1) + "&deg;";
        
        n1 = parseFloat(n1Slider.value);
        document.getElementById("n1Value").innerText = n1.toFixed(2);
        
        n2 = parseFloat(n2Slider.value);
        document.getElementById("n2Value").innerText = n2.toFixed(2);
        
        lambda = parseFloat(lambdaSlider.value);
        document.getElementById("lambdaValue").innerText = lambda.toFixed(1);
        k = (2 * Math.PI) / lambda;

        // Update Tick Marks
        if (angleTickMarks) {
            angleTickMarks.innerHTML = '<span>0&deg;</span>';
            const theta_b = Math.atan(n2 / n1);
            const theta_b_deg = theta_b * 180 / Math.PI;
            const percentB = (theta_b_deg / 89) * 100;
            if(percentB >= 0 && percentB <= 100) {
                const bTick = document.createElement('span');
                bTick.style.left = `${percentB}%`;
                bTick.style.position = 'absolute';
                bTick.style.transform = 'translateX(-50%)';
                bTick.style.color = 'var(--accent)';
                bTick.innerText = `Brewster (${theta_b_deg.toFixed(1)}\xB0)`;
                angleTickMarks.appendChild(bTick);
            }
            if (n1 > n2) {
                const theta_c = Math.asin(n2 / n1);
                const theta_c_deg = theta_c * 180 / Math.PI;
                const percentC = (theta_c_deg / 89) * 100;
                if(percentC >= 0 && percentC <= 100) {
                    const cTick = document.createElement('span');
                    cTick.style.left = `${percentC}%`;
                    cTick.style.position = 'absolute';
                    cTick.style.transform = 'translateX(-50%)';
                    cTick.style.color = '#f87171'; // TE color for alert
                    cTick.innerText = `TIR (${theta_c_deg.toFixed(1)}\xB0)`;
                    angleTickMarks.appendChild(cTick);
                }
            }
            const endTick = document.createElement('span');
            endTick.innerHTML = '89&deg;';
            angleTickMarks.appendChild(endTick);
        }

        // Snell's Law
        const sin_t = (n1 / n2) * Math.sin(theta_i);

        // Fresnel Equations & TIR
        if (sin_t > 1) {
            // Total Internal Reflection
            theta_t = Math.PI / 2; // transmitted angle doesn't really matter as t=0
            r_TE = 1; // Simplification: full amplitude reflection
            r_TM = 1;
            t_TE = 0;
            t_TM = 0;
            rTeValue.innerText = "TIR (1.0)";
            rTmValue.innerText = "TIR (1.0)";
            rTmValue.style.opacity = "1";
        } else {
            theta_t = Math.asin(sin_t);
            const cos_i = Math.cos(theta_i);
            const cos_t = Math.cos(theta_t);

            r_TE = (n1 * cos_i - n2 * cos_t) / (n1 * cos_i + n2 * cos_t);
            r_TM = (n2 * cos_i - n1 * cos_t) / (n2 * cos_i + n1 * cos_t);
            t_TE = (2 * n1 * cos_i) / (n1 * cos_i + n2 * cos_t);
            t_TM = (2 * n1 * cos_i) / (n2 * cos_i + n1 * cos_t);

            rTeValue.innerText = r_TE.toFixed(3);
            rTmValue.innerText = r_TM.toFixed(3);

            // Highlight brewster visually if near
            const isBrewster = Math.abs(r_TM) < 0.005;
            rTmValue.style.opacity = isBrewster ? "0.3" : "1";
        }
    }

    function updateWaveGeometry() {
        const ti = incidentAngle;
        const tt = theta_t;

        // Directions
        const dirInc = new THREE.Vector3(Math.sin(ti), -Math.cos(ti), 0);
        const startInc = new THREE.Vector3(-L * Math.sin(ti), L * Math.cos(ti), 0);

        const dirRef = new THREE.Vector3(Math.sin(ti), Math.cos(ti), 0);
        const dirTrans = new THREE.Vector3(Math.sin(tt), -Math.cos(tt), 0);

        // Update Base Rays
        incRayGeo.setFromPoints([startInc, new THREE.Vector3(0, 0, 0)]);
        refRayGeo.setFromPoints([new THREE.Vector3(0, 0, 0), dirRef.clone().multiplyScalar(L)]);
        transRayGeo.setFromPoints([new THREE.Vector3(0, 0, 0), dirTrans.clone().multiplyScalar(L)]);
        incRayLine.computeLineDistances();
        refRayLine.computeLineDistances();
        transRayLine.computeLineDistances();

        const tmPerpInc = new THREE.Vector3(Math.cos(ti), Math.sin(ti), 0);
        const tmPerpRef = new THREE.Vector3(Math.cos(ti), -Math.sin(ti), 0);
        const tmPerpTrans = new THREE.Vector3(Math.cos(tt), Math.sin(tt), 0);
        
        const tePerp = new THREE.Vector3(0, 0, 1);

        for (let i = 0; i < numPoints; i++) {
            const s = (i / (numPoints - 1)) * L;
            
            // Incident Phase (starts at -L to reach origin at 0 phase)
            const phaseInc = k * (s - L) - w * time;
            const incSine = Math.sin(phaseInc);
            
            const incBase = startInc.clone().add(dirInc.clone().multiplyScalar(s));
            const ite = incBase.clone().add(tePerp.clone().multiplyScalar(incSine));
            const itm = incBase.clone().add(tmPerpInc.clone().multiplyScalar(incSine));
            
            incTePos[i*3] = ite.x; incTePos[i*3+1] = ite.y; incTePos[i*3+2] = ite.z;
            incTmPos[i*3] = itm.x; incTmPos[i*3+1] = itm.y; incTmPos[i*3+2] = itm.z;

            incTeRibbonPos[i*6] = incBase.x; incTeRibbonPos[i*6+1] = incBase.y; incTeRibbonPos[i*6+2] = incBase.z;
            incTeRibbonPos[i*6+3] = ite.x; incTeRibbonPos[i*6+4] = ite.y; incTeRibbonPos[i*6+5] = ite.z;
            
            incTmRibbonPos[i*6] = incBase.x; incTmRibbonPos[i*6+1] = incBase.y; incTmRibbonPos[i*6+2] = incBase.z;
            incTmRibbonPos[i*6+3] = itm.x; incTmRibbonPos[i*6+4] = itm.y; incTmRibbonPos[i*6+5] = itm.z;

            // Reflected/Transmitted Phase (starts at origin at 0 phase)
            const phaseOut = k * s - w * time;
            const outSine = Math.sin(phaseOut);

            const refBase = dirRef.clone().multiplyScalar(s);
            const rte = refBase.clone().add(tePerp.clone().multiplyScalar(r_TE * outSine));
            const rtm = refBase.clone().add(tmPerpRef.clone().multiplyScalar(r_TM * outSine));
            
            refTePos[i*3] = rte.x; refTePos[i*3+1] = rte.y; refTePos[i*3+2] = rte.z;
            refTmPos[i*3] = rtm.x; refTmPos[i*3+1] = rtm.y; refTmPos[i*3+2] = rtm.z;

            refTeRibbonPos[i*6] = refBase.x; refTeRibbonPos[i*6+1] = refBase.y; refTeRibbonPos[i*6+2] = refBase.z;
            refTeRibbonPos[i*6+3] = rte.x; refTeRibbonPos[i*6+4] = rte.y; refTeRibbonPos[i*6+5] = rte.z;

            refTmRibbonPos[i*6] = refBase.x; refTmRibbonPos[i*6+1] = refBase.y; refTmRibbonPos[i*6+2] = refBase.z;
            refTmRibbonPos[i*6+3] = rtm.x; refTmRibbonPos[i*6+4] = rtm.y; refTmRibbonPos[i*6+5] = rtm.z;

            const transBase = dirTrans.clone().multiplyScalar(s);
            const tte = transBase.clone().add(tePerp.clone().multiplyScalar(t_TE * outSine));
            const ttm = transBase.clone().add(tmPerpTrans.clone().multiplyScalar(t_TM * outSine));
            
            transTePos[i*3] = tte.x; transTePos[i*3+1] = tte.y; transTePos[i*3+2] = tte.z;
            transTmPos[i*3] = ttm.x; transTmPos[i*3+1] = ttm.y; transTmPos[i*3+2] = ttm.z;

            transTeRibbonPos[i*6] = transBase.x; transTeRibbonPos[i*6+1] = transBase.y; transTeRibbonPos[i*6+2] = transBase.z;
            transTeRibbonPos[i*6+3] = tte.x; transTeRibbonPos[i*6+4] = tte.y; transTeRibbonPos[i*6+5] = tte.z;

            transTmRibbonPos[i*6] = transBase.x; transTmRibbonPos[i*6+1] = transBase.y; transTmRibbonPos[i*6+2] = transBase.z;
            transTmRibbonPos[i*6+3] = ttm.x; transTmRibbonPos[i*6+4] = ttm.y; transTmRibbonPos[i*6+5] = ttm.z;
        }

        incTeGeo.attributes.position.needsUpdate = true;
        incTmGeo.attributes.position.needsUpdate = true;
        refTeGeo.attributes.position.needsUpdate = true;
        refTmGeo.attributes.position.needsUpdate = true;
        transTeGeo.attributes.position.needsUpdate = true;
        transTmGeo.attributes.position.needsUpdate = true;

        incTeRibbonGeo.attributes.position.needsUpdate = true;
        incTmRibbonGeo.attributes.position.needsUpdate = true;
        refTeRibbonGeo.attributes.position.needsUpdate = true;
        refTmRibbonGeo.attributes.position.needsUpdate = true;
        transTeRibbonGeo.attributes.position.needsUpdate = true;
        transTmRibbonGeo.attributes.position.needsUpdate = true;
    }

    let isWater = false;
    const materialRadios = document.querySelectorAll('input[name="material"]');
    materialRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'water') {
                isWater = true;
                surfaceMaterial.color.setHex(0x0ea5e9); // slightly darker/deeper blue
                surfaceMaterial.ior = 1.33;
                n2Slider.value = 1.33;
            } else {
                isWater = false;
                surfaceMaterial.color.setHex(0x38bdf8); // glass blue
                surfaceMaterial.ior = 1.52;
                n2Slider.value = 1.52;
                
                // reset vertices back to flat
                const pos = surfaceGeometry.attributes.position;
                const origPos = originalPositions;
                for(let i=0; i<pos.count; i++) {
                    pos.setY(i, origPos.getY(i));
                }
                pos.needsUpdate = true;
                surfaceGeometry.computeVertexNormals();
            }
            updatePhysics();
        });
    });

    slider.addEventListener('input', updatePhysics);
    n1Slider.addEventListener('input', updatePhysics);
    n2Slider.addEventListener('input', updatePhysics);
    lambdaSlider.addEventListener('input', updatePhysics);
    updatePhysics();

    // Auto Rotate camera listener
    const autoRotateToggle = document.getElementById("autoRotateToggle");
    if (autoRotateToggle) {
        autoRotateToggle.addEventListener("change", (e) => {
            controls.autoRotate = e.target.checked;
        });
    }

    const waveViewRadios = document.querySelectorAll('input[name="waveView"]');
    waveViewRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'all') {
                teObjects.forEach(o => o.visible = true);
                tmObjects.forEach(o => o.visible = true);
            } else if (val === 'te') {
                teObjects.forEach(o => o.visible = true);
                tmObjects.forEach(o => o.visible = false);
            } else if (val === 'tm') {
                teObjects.forEach(o => o.visible = false);
                tmObjects.forEach(o => o.visible = true);
            }
        });
    });

    // Draggable Panels
    const panels = document.querySelectorAll('.ui-panel');
    panels.forEach(panel => {
        const title = panel.querySelector('.title');
        if (!title) return;

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        title.addEventListener('pointerdown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            // Get actual computed position to handle transform issues
            const rect = panel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            
            // Remove bottom/right positioning constraints and transform
            panel.style.bottom = 'auto';
            panel.style.right = 'auto';
            panel.style.transform = 'none';
            panel.style.left = initialLeft + 'px';
            panel.style.top = initialTop + 'px';
            
            title.setPointerCapture(e.pointerId);
        });

        title.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panel.style.left = (initialLeft + dx) + 'px';
            panel.style.top = (initialTop + dy) + 'px';
        });

        title.addEventListener('pointerup', (e) => {
            isDragging = false;
            if(title.hasPointerCapture(e.pointerId)) {
                title.releasePointerCapture(e.pointerId);
            }
        });
    });

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();
        
        controls.update();

        if (isWater) {
            const pos = surfaceGeometry.attributes.position;
            const origPos = originalPositions;
            for(let i = 0; i < pos.count; i++) {
                // Top vertices of BoxGeometry (local Y = 5)
                if (origPos.getY(i) > 4.9) {
                    const x = origPos.getX(i);
                    const z = origPos.getZ(i);
                    
                    // Sum two circular ripples for organic "flowing" interference
                    const d1 = Math.sqrt(x * x + z * z);
                    const d2 = Math.sqrt((x - 10) * (x - 10) + (z - 5) * (z - 5));
                    
                    const w1 = 0.12 * Math.sin(d1 * 1.2 - elapsedTime * 2.5);
                    const w2 = 0.06 * Math.sin(d2 * 2.0 - elapsedTime * 3.5);
                    
                    pos.setY(i, origPos.getY(i) + w1 + w2);
                }
            }
            pos.needsUpdate = true;
            surfaceGeometry.computeVertexNormals();
        }
        
        // Use consistent time for wave physics
        time = elapsedTime;
        updateWaveGeometry();
        renderer.render(scene, camera);
    }

    animate();

    // Handle resize
    window.addEventListener('resize', onWindowResize, false);
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}