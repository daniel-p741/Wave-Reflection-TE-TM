window.onload = function () {
    const container = document.querySelector('#canvas-container');
    const scene = new THREE.Scene();
    
    // Camera
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 18);
    camera.lookAt(new THREE.Vector3(0, -2, 0));

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x0f172a, 1);
    container.appendChild(renderer.domElement);

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

    // Glass interface (y = 0)
    const glassGeometry = new THREE.BoxGeometry(30, 10, 10);
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transmission: 0.9,
        opacity: 1,
        metalness: 0,
        roughness: 0.1,
        ior: 1.5,
        transparent: true,
        side: THREE.DoubleSide
    });
    const glassPlane = new THREE.Mesh(glassGeometry, glassMaterial);
    glassPlane.position.y = -5; // Top face is at y=0
    scene.add(glassPlane);
    
    // Grid Helper at y=0
    const gridHelper = new THREE.GridHelper(30, 30, 0x38bdf8, 0x475569);
    gridHelper.position.y = 0;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Wave parameters
    const n1 = 1.0;
    const n2 = 1.5;
    const L = 10; // Length of rays
    const numPoints = 200;
    const lambda = 2.5; // Wavelength
    const k = (2 * Math.PI) / lambda;
    const w = 5; // Angular frequency

    // State Variables
    let time = 0;
    let incidentAngle = 45 * Math.PI / 180;
    let r_TE = 0, r_TM = 0, t_TE = 0, t_TM = 0;
    let theta_t = 0;

    // Arrays to hold vertex position arrays
    const incTePos = new Float32Array(numPoints * 3);
    const incTmPos = new Float32Array(numPoints * 3);
    const refTePos = new Float32Array(numPoints * 3);
    const refTmPos = new Float32Array(numPoints * 3);
    const transTePos = new Float32Array(numPoints * 3);
    const transTmPos = new Float32Array(numPoints * 3);

    // Geometries
    const makeGeo = (pos) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        return geo;
    };

    const incTeGeo = makeGeo(incTePos);
    const incTmGeo = makeGeo(incTmPos);
    const refTeGeo = makeGeo(refTePos);
    const refTmGeo = makeGeo(refTmPos);
    const transTeGeo = makeGeo(transTePos);
    const transTmGeo = makeGeo(transTmPos);

    // Meshes
    const incTeLine = new THREE.Line(incTeGeo, teMaterial);
    const incTmLine = new THREE.Line(incTmGeo, tmMaterial);
    const refTeLine = new THREE.Line(refTeGeo, teMaterial);
    const refTmLine = new THREE.Line(refTmGeo, tmMaterial);
    const transTeLine = new THREE.Line(transTeGeo, teMaterial);
    const transTmLine = new THREE.Line(transTmGeo, tmMaterial);

    scene.add(incTeLine, incTmLine, refTeLine, refTmLine, transTeLine, transTmLine);

    // Support ray lines (dashed)
    const incRayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const refRayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const transRayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const incRayLine = new THREE.Line(incRayGeo, rayMaterial);
    const refRayLine = new THREE.Line(refRayGeo, rayMaterial);
    const transRayLine = new THREE.Line(transRayGeo, rayMaterial);
    incRayLine.computeLineDistances();
    refRayLine.computeLineDistances();
    transRayLine.computeLineDistances();
    scene.add(incRayLine, refRayLine, transRayLine);

    const normalGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -L, 0), new THREE.Vector3(0, L, 0)]);
    const normalLine = new THREE.Line(normalGeo, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.4, gapSize: 0.2, opacity: 0.5, transparent: true }));
    normalLine.computeLineDistances();
    scene.add(normalLine);

    // UI Elements
    const slider = document.getElementById("incidentAngle");
    const angleValue = document.getElementById("angleValue");
    const rTeValue = document.getElementById("rTeValue");
    const rTmValue = document.getElementById("rTmValue");

    function updatePhysics() {
        const theta_i = parseFloat(slider.value) * Math.PI / 180;
        incidentAngle = theta_i;
        angleValue.innerHTML = parseFloat(slider.value).toFixed(1) + "&deg;";

        // Snell's Law
        const sin_t = (n1 / n2) * Math.sin(theta_i);
        theta_t = Math.asin(sin_t);

        // Fresnel Equations
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

            // Reflected/Transmitted Phase (starts at origin at 0 phase)
            const phaseOut = k * s - w * time;
            const outSine = Math.sin(phaseOut);

            const refBase = dirRef.clone().multiplyScalar(s);
            const rte = refBase.clone().add(tePerp.clone().multiplyScalar(r_TE * outSine));
            const rtm = refBase.clone().add(tmPerpRef.clone().multiplyScalar(r_TM * outSine));
            
            refTePos[i*3] = rte.x; refTePos[i*3+1] = rte.y; refTePos[i*3+2] = rte.z;
            refTmPos[i*3] = rtm.x; refTmPos[i*3+1] = rtm.y; refTmPos[i*3+2] = rtm.z;

            const transBase = dirTrans.clone().multiplyScalar(s);
            const tte = transBase.clone().add(tePerp.clone().multiplyScalar(t_TE * outSine));
            const ttm = transBase.clone().add(tmPerpTrans.clone().multiplyScalar(t_TM * outSine));
            
            transTePos[i*3] = tte.x; transTePos[i*3+1] = tte.y; transTePos[i*3+2] = tte.z;
            transTmPos[i*3] = ttm.x; transTmPos[i*3+1] = ttm.y; transTmPos[i*3+2] = ttm.z;
        }

        incTeGeo.attributes.position.needsUpdate = true;
        incTmGeo.attributes.position.needsUpdate = true;
        refTeGeo.attributes.position.needsUpdate = true;
        refTmGeo.attributes.position.needsUpdate = true;
        transTeGeo.attributes.position.needsUpdate = true;
        transTmGeo.attributes.position.needsUpdate = true;
    }

    slider.addEventListener('input', updatePhysics);
    updatePhysics();

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        time += clock.getDelta();
        
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