// Traffic Intersection Simulation - 4-Way Intersection
// Matrix Model: x_{t+Δt} = x_t + A_t - S_t

class TrafficSimulation {
    constructor() {
        // Simulation state
        this.isRunning = false;
        this.animationFrame = null;
        this.simulationTime = 0;
        this.dt = 0.5; // time step in seconds
        
        // Parameters - lanes per direction
        this.lanesNorth = 2;
        this.lanesSouth = 2;
        this.lanesEast = 2;
        this.lanesWest = 2;
        
        // Signal timing
        this.greenTime = 30; // Green time per direction (N-S or E-W)
        this.bikePhase = 15; // All red phase for bike passing
        this.T = 1.2; // reaction delay
        this.A = 0.8; // sensitivity
        this.lambda = 20; // arrival rate (veh/min)
        this.capacity = 50; // max cars per lane
        
        // State vectors - organized by direction
        this.x = {
            north: [],
            south: [],
            east: [],
            west: []
        };
        
        this.currentPhase = 'red'; // 'red', 'green-ns', 'green-ew', 'pedestrian'
        this.phaseTime = 0;
        this.cycleTime = 0;
        
        // Data collection
        this.dataHistory = {
            time: [],
            queueLengths: [],
            delays: [],
            throughput: [],
            cumulativeDelay: 0,
            vehiclesServed: 0
        };
        
        // Results for different parameter sets
        this.results = [];
        
        // Canvas setup
        this.canvas = document.getElementById('intersection-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        
        // Charts
        this.queueChart = null;
        this.delayChart = null;
        
        // Constants
        this.v_min = 2.0; // m/s
        this.v_0 = 10.0; // m/s
        this.tau = 0.3; // clearance time (s)
        
        this.initialize();
        this.setupEventListeners();
        this.initializeCharts();
    }
    
    setupCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }
    
    // Get total number of lanes
    getTotalLanes() {
        return this.lanesNorth + this.lanesSouth + this.lanesEast + this.lanesWest;
    }
    
    // Get all queue lengths as flat array
    getAllQueues() {
        return [
            ...this.x.north,
            ...this.x.south,
            ...this.x.east,
            ...this.x.west
        ];
    }
    
    initialize() {
        // Initialize queue lengths for all lanes in all directions
        this.x.north = new Array(this.lanesNorth).fill(0);
        this.x.south = new Array(this.lanesSouth).fill(0);
        this.x.east = new Array(this.lanesEast).fill(0);
        this.x.west = new Array(this.lanesWest).fill(0);
        
        this.simulationTime = 0;
        this.phaseTime = 0;
        this.cycleTime = 0;
        // Start with N-S green
        this.currentPhase = 'green-ns';
        
        // Reset data history
        this.dataHistory = {
            time: [],
            queueLengths: [],
            delays: [],
            throughput: [],
            cumulativeDelay: 0,
            vehiclesServed: 0
        };
        
        this.updateLanesDisplay();
        this.draw();
    }
    
    // Calculate saturation flow rate from equations (2), (3), (4)
    calculateSaturationFlow() {
        // t_roll = T + v_min / (A * v_0)  (Equation 2)
        const t_roll = this.T + this.v_min / (this.A * this.v_0);
        
        // h = t_roll + tau  (Equation 3)
        const h = t_roll + this.tau;
        
        // s = 1 / h  (Equation 4)
        const s = 1 / h; // vehicles per second
        
        return s * 3600; // convert to vehicles per hour
    }
    
    // Calculate theoretical average delay (Equation 8)
    calculateTheoreticalDelay() {
        const s = this.calculateSaturationFlow() / 3600; // veh/s
        const lambda_sec = this.lambda / 60; // veh/s
        // Red time for each direction = green time of opposite direction + bike phase
        const r = this.greenTime + this.bikePhase;
        const g = this.greenTime; // Green time per direction
        const C = this.greenTime * 2 + this.bikePhase; // cycle length
        
        if (s <= lambda_sec) {
            return Infinity; // unstable system
        }
        
        // W = (r² / (2C)) * (1 + λ / (s - λ))  (Equation 8)
        const W = (r * r / (2 * C)) * (1 + lambda_sec / (s - lambda_sec));
        return W;
    }
    
    // Generate Poisson arrivals (Equation 5)
    generatePoissonArrivals(dt, numLanes) {
        const lambda_interval = (this.lambda / 60) * dt; // arrival rate for time interval
        const arrivals = [];
        
        for (let i = 0; i < numLanes; i++) {
            // Poisson process: P(Y = y) = (λ^y * e^(-λ)) / y!
            let numArrivals = 0;
            let p = Math.exp(-lambda_interval);
            let u = Math.random();
            let cumulative = p;
            
            while (u > cumulative) {
                numArrivals++;
                p = p * lambda_interval / numArrivals;
                cumulative += p;
            }
            
            arrivals.push(numArrivals);
        }
        
        return arrivals;
    }
    
    // Update signal phase
    updatePhase() {
        this.phaseTime += this.dt;
        this.cycleTime += this.dt;
        
        // Cycle: N-S green -> E-W green -> All red (bike phase) -> repeat
        const cycleLength = this.greenTime * 2 + this.bikePhase;
        
        if (this.cycleTime >= cycleLength) {
            this.cycleTime = 0;
        }
        
        if (this.cycleTime < this.greenTime) {
            // Phase 1: North-South green, East-West red
            this.currentPhase = 'green-ns';
            this.phaseTime = this.cycleTime;
        } else if (this.cycleTime < this.greenTime * 2) {
            // Phase 2: East-West green, North-South red
            this.currentPhase = 'green-ew';
            this.phaseTime = this.cycleTime - this.greenTime;
        } else {
            // Phase 3: All red (bike phase)
            this.currentPhase = 'bike';
            this.phaseTime = this.cycleTime - this.greenTime * 2;
        }
    }
    
    // Calculate service vector S_t for all lanes
    calculateService() {
        const s_per_second = this.calculateSaturationFlow() / 3600; // veh/s
        const service = {
            north: new Array(this.lanesNorth).fill(0),
            south: new Array(this.lanesSouth).fill(0),
            east: new Array(this.lanesEast).fill(0),
            west: new Array(this.lanesWest).fill(0)
        };
        
        if (this.currentPhase === 'green-ns') {
            // North-South green
            for (let i = 0; i < this.lanesNorth; i++) {
                const maxService = s_per_second * this.dt;
                service.north[i] = Math.min(this.x.north[i], maxService);
            }
            for (let i = 0; i < this.lanesSouth; i++) {
                const maxService = s_per_second * this.dt;
                service.south[i] = Math.min(this.x.south[i], maxService);
            }
        } else if (this.currentPhase === 'green-ew') {
            // East-West green
            for (let i = 0; i < this.lanesEast; i++) {
                const maxService = s_per_second * this.dt;
                service.east[i] = Math.min(this.x.east[i], maxService);
            }
            for (let i = 0; i < this.lanesWest; i++) {
                const maxService = s_per_second * this.dt;
                service.west[i] = Math.min(this.x.west[i], maxService);
            }
        }
        
        return service;
    }
    
    // Matrix update: x_{t+Δt} = x_t + A_t - S_t (Equation 9)
    update() {
        // Generate arrivals for each direction
        const A_t = {
            north: this.generatePoissonArrivals(this.dt, this.lanesNorth),
            south: this.generatePoissonArrivals(this.dt, this.lanesSouth),
            east: this.generatePoissonArrivals(this.dt, this.lanesEast),
            west: this.generatePoissonArrivals(this.dt, this.lanesWest)
        };
        
        // Calculate service
        const S_t = this.calculateService();
        
        // Update queue lengths for each direction
        const directions = ['north', 'south', 'east', 'west'];
        directions.forEach(dir => {
            for (let i = 0; i < this.x[dir].length; i++) {
                // Add arrivals
                this.x[dir][i] += A_t[dir][i];
                
                // Subtract service
                this.x[dir][i] -= S_t[dir][i];
                
                // Apply capacity constraint
                this.x[dir][i] = Math.max(0, Math.min(this.x[dir][i], this.capacity));
            }
        });
        
        // Update signal phase
        this.updatePhase();
        
        // Update simulation time
        this.simulationTime += this.dt;
        
        // Collect data
        this.collectData(S_t);
    }
    
    // Collect data for analysis
    collectData(service) {
        const allQueues = this.getAllQueues();
        const totalQueue = allQueues.reduce((sum, q) => sum + q, 0);
        
        const allService = [
            ...service.north,
            ...service.south,
            ...service.east,
            ...service.west
        ];
        const totalService = allService.reduce((sum, s) => sum + s, 0);
        const throughput = (totalService / this.dt) * 3600; // veh/h
        
        // Cumulative delay: each vehicle in queue accumulates delay at rate dt
        this.dataHistory.cumulativeDelay += totalQueue * this.dt;
        this.dataHistory.vehiclesServed += totalService;
        
        // Calculate instantaneous delay estimate
        const instantaneousDelay = totalQueue > 0 
            ? this.calculateInstantaneousDelay(totalQueue)
            : 0;
        
        this.dataHistory.time.push(this.simulationTime);
        this.dataHistory.queueLengths.push(totalQueue);
        this.dataHistory.delays.push(instantaneousDelay);
        this.dataHistory.throughput.push(throughput);
        
        // Keep only last 1000 data points for performance
        if (this.dataHistory.time.length > 1000) {
            this.dataHistory.time.shift();
            this.dataHistory.queueLengths.shift();
            this.dataHistory.delays.shift();
            this.dataHistory.throughput.shift();
        }
    }
    
    // Calculate instantaneous delay estimate
    calculateInstantaneousDelay(queueLength) {
        const theoreticalDelay = this.calculateTheoreticalDelay();
        if (theoreticalDelay === Infinity) return queueLength * 0.5;
        
        const s = this.calculateSaturationFlow() / 3600; // veh/s per lane
        const lambda_sec = this.lambda / 60; // veh/s
        const totalLanes = this.getTotalLanes();
        
        if (this.currentPhase === 'green-ns' || this.currentPhase === 'green-ew') {
            // During green: delay = queue / service_rate
            const activeLanes = this.currentPhase === 'green-ns' 
                ? this.lanesNorth + this.lanesSouth
                : this.lanesEast + this.lanesWest;
            return queueLength / (s * activeLanes + 0.001);
        } else {
            // During red: delay accumulates
            return queueLength / (lambda_sec * totalLanes + 0.001);
        }
    }
    
    // Draw intersection visualization
    draw() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw road background
        ctx.fillStyle = '#34495e';
        ctx.fillRect(0, 0, width, height);
        
        // Draw intersection (center area)
        const centerX = width / 2;
        const centerY = height / 2;
        const roadWidth = Math.min(width, height) * 0.4;
        const intersectionSize = roadWidth * 0.3;
        
        // Draw roads
        ctx.fillStyle = '#2c3e50';
        // North-South road
        ctx.fillRect(centerX - roadWidth / 2, 0, roadWidth, height);
        // East-West road
        ctx.fillRect(0, centerY - roadWidth / 2, width, roadWidth);
        
        // Draw intersection center
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(centerX - intersectionSize / 2, centerY - intersectionSize / 2, 
                    intersectionSize, intersectionSize);
        
        // Draw lanes and queues for each direction
        const laneWidth = roadWidth / 4;
        const queueMaxLength = roadWidth * 0.8;
        
        // North (top)
        this.drawDirection(ctx, centerX, 0, 0, 1, this.x.north, this.lanesNorth, 
                          laneWidth, queueMaxLength, 'N', this.currentPhase === 'green-ns');
        
        // South (bottom)
        this.drawDirection(ctx, centerX, height, 0, -1, this.x.south, this.lanesSouth, 
                          laneWidth, queueMaxLength, 'S', this.currentPhase === 'green-ns');
        
        // East (right)
        this.drawDirection(ctx, width, centerY, -1, 0, this.x.east, this.lanesEast, 
                          laneWidth, queueMaxLength, 'E', this.currentPhase === 'green-ew');
        
        // West (left)
        this.drawDirection(ctx, 0, centerY, 1, 0, this.x.west, this.lanesWest, 
                          laneWidth, queueMaxLength, 'W', this.currentPhase === 'green-ew');
        
        // Draw signal at center
        this.drawSignal(ctx, centerX, centerY, intersectionSize);
        
        // Draw bike phase indicator if in bike phase
        if (this.currentPhase === 'bike') {
            ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
            ctx.fillRect(centerX - intersectionSize / 2, centerY - intersectionSize / 2,
                        intersectionSize, intersectionSize);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('BIKE', centerX, centerY - 5);
            ctx.font = '12px Arial';
            ctx.fillText('PHASE', centerX, centerY + 8);
        }
    }
    
    // Draw lanes for a direction
    drawDirection(ctx, startX, startY, dirX, dirY, queues, numLanes, laneWidth, maxQueueLength, label, isGreen) {
        const spacing = laneWidth * 1.2;
        const startOffset = -(numLanes - 1) * spacing / 2;
        
        for (let i = 0; i < numLanes; i++) {
            const laneX = startX + (startOffset + i * spacing) * (dirY === 0 ? 1 : 0);
            const laneY = startY + (startOffset + i * spacing) * (dirX === 0 ? 1 : 0);
            
            const queueLength = queues[i] || 0;
            const queueRatio = Math.min(queueLength / this.capacity, 1);
            const visualQueueLength = queueRatio * maxQueueLength;
            
            // Draw lane
            ctx.fillStyle = '#2c3e50';
            if (dirX === 0) {
                // Vertical lane
                ctx.fillRect(laneX - laneWidth / 2, laneY - maxQueueLength * dirY, 
                           laneWidth, maxQueueLength);
            } else {
                // Horizontal lane
                ctx.fillRect(laneX - maxQueueLength * dirX, laneY - laneWidth / 2, 
                           maxQueueLength, laneWidth);
            }
            
            // Draw queue
            if (queueLength > 0) {
                const colorIntensity = Math.min(255, 100 + queueRatio * 155);
                ctx.fillStyle = `rgb(${255 - colorIntensity}, ${colorIntensity}, 0)`;
                
                if (dirX === 0) {
                    ctx.fillRect(laneX - laneWidth / 2 + 2, 
                               laneY - visualQueueLength * dirY, 
                               laneWidth - 4, visualQueueLength);
                } else {
                    ctx.fillRect(laneX - visualQueueLength * dirX, 
                               laneY - laneWidth / 2 + 2, 
                               visualQueueLength, laneWidth - 4);
                }
                
                // Draw individual vehicles
                const numVehicles = Math.min(queueLength, 15);
                const vehicleSize = maxQueueLength / 15;
                for (let j = 0; j < numVehicles; j++) {
                    if (j * vehicleSize < visualQueueLength) {
                        ctx.fillStyle = isGreen ? '#27ae60' : '#e74c3c';
                        if (dirX === 0) {
                            ctx.fillRect(laneX - laneWidth / 2 + 3, 
                                       laneY - (j + 1) * vehicleSize * dirY - 3,
                                       laneWidth - 6, vehicleSize - 2);
                        } else {
                            ctx.fillRect(laneX - (j + 1) * vehicleSize * dirX - 3,
                                       laneY - laneWidth / 2 + 3,
                                       vehicleSize - 2, laneWidth - 6);
                        }
                    }
                }
            }
            
            // Draw lane label
            ctx.fillStyle = '#ecf0f1';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (dirX === 0) {
                ctx.fillText(`${label}${i + 1}`, laneX, laneY - maxQueueLength * dirY - 15);
                ctx.fillText(Math.round(queueLength), laneX, laneY - maxQueueLength * dirY - 30);
            } else {
                ctx.fillText(`${label}${i + 1}`, laneX - maxQueueLength * dirX - 15, laneY);
                ctx.fillText(Math.round(queueLength), laneX - maxQueueLength * dirX - 30, laneY);
            }
        }
    }
    
    // Draw traffic signal
    drawSignal(ctx, x, y, size) {
        const signalSize = size * 0.3;
        const offset = size * 0.35;
        
        // Determine signal state for each direction based on current phase
        let northPhase, southPhase, eastPhase, westPhase;
        
        if (this.currentPhase === 'green-ns') {
            northPhase = 'green';
            southPhase = 'green';
            eastPhase = 'red';
            westPhase = 'red';
        } else if (this.currentPhase === 'green-ew') {
            northPhase = 'red';
            southPhase = 'red';
            eastPhase = 'green';
            westPhase = 'green';
        } else { // bike phase - all red
            northPhase = 'red';
            southPhase = 'red';
            eastPhase = 'red';
            westPhase = 'red';
        }
        
        // Draw signals for each direction
        const signals = [
            { x: x, y: y - offset, phase: northPhase }, // North
            { x: x, y: y + offset, phase: southPhase }, // South
            { x: x + offset, y: y, phase: eastPhase }, // East
            { x: x - offset, y: y, phase: westPhase }  // West
        ];
        
        signals.forEach(signal => {
            ctx.fillStyle = signal.phase === 'green' ? '#27ae60' : '#e74c3c';
            if (signal.phase === 'green') {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#27ae60';
            } else {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#e74c3c';
            }
            ctx.beginPath();
            ctx.arc(signal.x, signal.y, signalSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
    }
    
    // Update lanes display
    updateLanesDisplay() {
        const container = document.getElementById('lanes-display');
        container.innerHTML = '';
        
        const directions = [
            { name: 'North', queues: this.x.north, lanes: this.lanesNorth },
            { name: 'South', queues: this.x.south, lanes: this.lanesSouth },
            { name: 'East', queues: this.x.east, lanes: this.lanesEast },
            { name: 'West', queues: this.x.west, lanes: this.lanesWest }
        ];
        
        directions.forEach(dir => {
            const panel = document.createElement('div');
            panel.className = 'direction-panel';
            panel.innerHTML = `<h4>${dir.name}</h4>`;
            
            for (let i = 0; i < dir.lanes; i++) {
                const laneDiv = document.createElement('div');
                laneDiv.className = 'lane-info';
                laneDiv.innerHTML = `
                    <span class="lane-label">Lane ${i + 1}</span>
                    <span class="lane-queue">${Math.round(dir.queues[i] || 0)}</span>
                `;
                panel.appendChild(laneDiv);
            }
            
            container.appendChild(panel);
        });
    }
    
    // Update statistics display
    updateStats() {
        const allQueues = this.getAllQueues();
        const totalQueue = allQueues.reduce((sum, q) => sum + q, 0);
        
        // Calculate average delay from cumulative data
        const avgDelay = this.dataHistory.vehiclesServed > 0
            ? this.dataHistory.cumulativeDelay / this.dataHistory.vehiclesServed
            : 0;
        
        // Calculate throughput
        const recentService = this.dataHistory.throughput.slice(-10);
        const avgThroughput = recentService.length > 0 
            ? recentService.reduce((a, b) => a + b, 0) / recentService.length 
            : 0;
        
        // Update DOM
        document.getElementById('total-queue').textContent = Math.round(totalQueue);
        document.getElementById('avg-delay').textContent = avgDelay.toFixed(2);
        document.getElementById('throughput').textContent = Math.round(avgThroughput);
        document.getElementById('sim-time').textContent = this.simulationTime.toFixed(1);
        
        // Theoretical delay
        const theoreticalDelay = this.calculateTheoreticalDelay();
        document.getElementById('theoretical-delay').textContent = 
            theoreticalDelay === Infinity ? '∞' : theoreticalDelay.toFixed(2);
        
        // Update signal status
        const signalLight = document.getElementById('signal-light');
        const signalText = document.getElementById('signal-text');
        const phaseTimeEl = document.getElementById('phase-time');
        const activeDirectionsEl = document.getElementById('active-directions');
        
        signalLight.className = 'signal-indicator';
        let activeDirs = 'None';
        let redDirs = 'All';
        
        if (this.currentPhase === 'green-ns') {
            signalLight.classList.add('signal-green');
            signalText.textContent = 'Green (N-S)';
            activeDirs = 'North, South';
            redDirs = 'East, West';
        } else if (this.currentPhase === 'green-ew') {
            signalLight.classList.add('signal-green');
            signalText.textContent = 'Green (E-W)';
            activeDirs = 'East, West';
            redDirs = 'North, South';
        } else if (this.currentPhase === 'bike') {
            signalLight.classList.add('signal-red');
            signalText.textContent = 'Bike Phase (All Red)';
            activeDirs = 'None';
            redDirs = 'All';
        }
        
        phaseTimeEl.textContent = this.phaseTime.toFixed(1);
        activeDirectionsEl.innerHTML = `<strong>Green:</strong> ${activeDirs}<br><strong>Red:</strong> ${redDirs}`;
    }
    
    // Animation loop
    animate() {
        if (!this.isRunning) return;
        
        // Update simulation
        this.update();
        
        // Update display
        this.draw();
        this.updateLanesDisplay();
        this.updateStats();
        this.updateCharts();
        
        // Schedule next frame
        this.animationFrame = setTimeout(() => {
            this.animate();
        }, this.dt * 1000);
    }
    
    // Start simulation
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.animate();
    }
    
    // Stop simulation
    stop() {
        this.isRunning = false;
        if (this.animationFrame) {
            clearTimeout(this.animationFrame);
            this.animationFrame = null;
        }
    }
    
    // Reset simulation
    reset() {
        this.stop();
        this.initialize();
        this.updateStats();
        this.updateCharts();
    }
    
    // Initialize charts
    initializeCharts() {
        // Queue length chart
        const queueCtx = document.getElementById('queue-chart').getContext('2d');
        this.queueChart = new Chart(queueCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Total Queue Length',
                    data: [],
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Queue Length (vehicles)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time (s)'
                        }
                    }
                }
            }
        });
        
        // Delay chart
        const delayCtx = document.getElementById('delay-chart').getContext('2d');
        this.delayChart = new Chart(delayCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Simulated Average Delay',
                    data: [],
                    borderColor: 'rgb(231, 76, 60)',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }, {
                    label: 'Theoretical Average Delay',
                    data: [],
                    borderColor: 'rgb(39, 174, 96)',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderDash: [5, 5]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Average Delay (s)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Arrival Rate λ (veh/min)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                }
            }
        });
    }
    
    // Update charts
    updateCharts() {
        if (this.dataHistory.time.length > 0) {
            const recentTime = this.dataHistory.time.slice(-100);
            const recentQueue = this.dataHistory.queueLengths.slice(-100);
            
            this.queueChart.data.labels = recentTime.map(t => t.toFixed(1));
            this.queueChart.data.datasets[0].data = recentQueue;
            this.queueChart.update('none');
        }
    }
    
    // Run simulation for data collection (non-visual, faster)
    async runSimulationStep(duration = 300) {
        const steps = Math.floor(duration / this.dt);
        
        const tempQueues = [];
        const tempDelays = [];
        const tempThroughput = [];
        
        for (let i = 0; i < steps; i++) {
            // Generate arrivals
            const A_t = {
                north: this.generatePoissonArrivals(this.dt, this.lanesNorth),
                south: this.generatePoissonArrivals(this.dt, this.lanesSouth),
                east: this.generatePoissonArrivals(this.dt, this.lanesEast),
                west: this.generatePoissonArrivals(this.dt, this.lanesWest)
            };
            
            // Calculate service
            const S_t = this.calculateService();
            
            // Update queue lengths
            const directions = ['north', 'south', 'east', 'west'];
            directions.forEach(dir => {
                for (let j = 0; j < this.x[dir].length; j++) {
                    this.x[dir][j] += A_t[dir][j];
                    this.x[dir][j] -= S_t[dir][j];
                    this.x[dir][j] = Math.max(0, Math.min(this.x[dir][j], this.capacity));
                }
            });
            
            // Update phase
            this.updatePhase();
            this.simulationTime += this.dt;
            
            // Collect data
            const allQueues = this.getAllQueues();
            const totalQueue = allQueues.reduce((sum, q) => sum + q, 0);
            
            const allService = [
                ...S_t.north,
                ...S_t.south,
                ...S_t.east,
                ...S_t.west
            ];
            const totalService = allService.reduce((sum, s) => sum + s, 0);
            const throughput = (totalService / this.dt) * 3600;
            
            const delay = this.calculateInstantaneousDelay(totalQueue);
            
            tempQueues.push(totalQueue);
            tempDelays.push(delay);
            tempThroughput.push(throughput);
        }
        
        // Calculate averages (skip first 20% to avoid transient)
        const skip = Math.floor(tempQueues.length * 0.2);
        const avgQueue = tempQueues.slice(skip).reduce((a, b) => a + b, 0) / (tempQueues.length - skip);
        const avgThroughput = tempThroughput.slice(skip).reduce((a, b) => a + b, 0) / (tempThroughput.length - skip);
        
        // Calculate average delay
        const totalDelay = tempQueues.slice(skip).reduce((sum, q) => sum + q * this.dt, 0);
        const totalServed = tempThroughput.slice(skip).reduce((sum, t) => {
            return sum + Math.max(0, t / 3600 * this.dt);
        }, 0);
        
        const avgDelay = totalServed > 0.1 
            ? totalDelay / totalServed
            : 0;
        
        return {
            avgDelay,
            avgQueue,
            avgThroughput,
            maxQueue: Math.max(...tempQueues),
            minQueue: Math.min(...tempQueues)
        };
    }
    
    // Run parameter sweep for delay vs lambda
    async runLambdaSweep() {
        const originalLambda = this.lambda;
        const lambdaValues = [];
        const simulatedDelays = [];
        const theoreticalDelays = [];
        
        this.results = this.results.filter(r => r.parameter !== 'λ');
        
        const exportBtn = document.getElementById('export-btn');
        const originalText = exportBtn.textContent;
        exportBtn.textContent = 'Running λ sweep...';
        exportBtn.disabled = true;
        
        this.reset();
        
        for (let lambda = 5; lambda <= 50; lambda += 5) {
            this.lambda = lambda;
            this.reset();
            
            const results = await this.runSimulationStep(300);
            const theoreticalDelay = this.calculateTheoreticalDelay();
            
            lambdaValues.push(lambda);
            simulatedDelays.push(results.avgDelay);
            theoreticalDelays.push(theoreticalDelay === Infinity ? null : theoreticalDelay);
            
            this.addResult({
                parameter: 'λ',
                value: lambda,
                avgQueue: results.avgQueue,
                avgDelay: results.avgDelay,
                theoreticalDelay: theoreticalDelay,
                throughput: results.avgThroughput
            });
        }
        
        this.lambda = originalLambda;
        this.reset();
        
        this.delayChart.data.labels = lambdaValues;
        this.delayChart.data.datasets[0].label = 'Simulated Average Delay';
        this.delayChart.data.datasets[0].data = simulatedDelays;
        this.delayChart.data.datasets[1].label = 'Theoretical Average Delay';
        this.delayChart.data.datasets[1].data = theoreticalDelays;
        this.delayChart.options.scales.x.title.text = 'Arrival Rate λ (veh/min)';
        this.delayChart.update();
        
        exportBtn.textContent = originalText;
        exportBtn.disabled = false;
    }
    
    // Run parameter sweep for delay vs reaction delay T
    async runTSweep() {
        const originalT = this.T;
        const TValues = [];
        const simulatedDelays = [];
        const theoreticalDelays = [];
        
        this.results = this.results.filter(r => r.parameter !== 'T');
        
        const exportBtn = document.getElementById('export-btn');
        const originalText = exportBtn.textContent;
        exportBtn.textContent = 'Running T sweep...';
        exportBtn.disabled = true;
        
        this.reset();
        
        for (let T = 0.5; T <= 3.0; T += 0.3) {
            this.T = T;
            document.getElementById('T').value = T;
            document.getElementById('T-value').textContent = T.toFixed(1);
            this.reset();
            
            const results = await this.runSimulationStep(300);
            const theoreticalDelay = this.calculateTheoreticalDelay();
            
            TValues.push(T.toFixed(1));
            simulatedDelays.push(results.avgDelay);
            theoreticalDelays.push(theoreticalDelay === Infinity ? null : theoreticalDelay);
            
            this.addResult({
                parameter: 'T',
                value: T.toFixed(2),
                avgQueue: results.avgQueue,
                avgDelay: results.avgDelay,
                theoreticalDelay: theoreticalDelay,
                throughput: results.avgThroughput
            });
        }
        
        this.T = originalT;
        document.getElementById('T').value = originalT;
        document.getElementById('T-value').textContent = originalT.toFixed(1);
        this.reset();
        
        this.delayChart.data.labels = TValues;
        this.delayChart.data.datasets[0].label = 'Simulated Average Delay (T variation)';
        this.delayChart.data.datasets[0].data = simulatedDelays;
        this.delayChart.data.datasets[1].label = 'Theoretical Average Delay (T variation)';
        this.delayChart.data.datasets[1].data = theoreticalDelays;
        this.delayChart.options.scales.x.title.text = 'Reaction Delay T (s)';
        this.delayChart.update();
        
        exportBtn.textContent = originalText;
        exportBtn.disabled = false;
    }
    
    // Run parameter sweep for delay vs green time
    async runGreenTimeSweep() {
        const originalGreenTime = this.greenTime;
        const greenValues = [];
        const simulatedDelays = [];
        const theoreticalDelays = [];
        
        this.results = this.results.filter(r => r.parameter !== 'Green Time');
        
        const exportBtn = document.getElementById('export-btn');
        const originalText = exportBtn.textContent;
        exportBtn.textContent = 'Running Green Time sweep...';
        exportBtn.disabled = true;
        
        this.reset();
        
        for (let greenTime = 10; greenTime <= 60; greenTime += 10) {
            this.greenTime = greenTime;
            document.getElementById('green-time').value = greenTime;
            document.getElementById('green-time-value').textContent = greenTime;
            this.reset();
            
            const results = await this.runSimulationStep(300);
            const theoreticalDelay = this.calculateTheoreticalDelay();
            
            greenValues.push(greenTime);
            simulatedDelays.push(results.avgDelay);
            theoreticalDelays.push(theoreticalDelay === Infinity ? null : theoreticalDelay);
            
            this.addResult({
                parameter: 'Green Time',
                value: greenTime,
                avgQueue: results.avgQueue,
                avgDelay: results.avgDelay,
                theoreticalDelay: theoreticalDelay,
                throughput: results.avgThroughput
            });
        }
        
        this.greenTime = originalGreenTime;
        document.getElementById('green-time').value = originalGreenTime;
        document.getElementById('green-time-value').textContent = originalGreenTime;
        this.reset();
        
        this.delayChart.data.labels = greenValues;
        this.delayChart.data.datasets[0].label = 'Simulated Average Delay (Green Time variation)';
        this.delayChart.data.datasets[0].data = simulatedDelays;
        this.delayChart.data.datasets[1].label = 'Theoretical Average Delay (Green Time variation)';
        this.delayChart.data.datasets[1].data = theoreticalDelays;
        this.delayChart.options.scales.x.title.text = 'Green Time (s)';
        this.delayChart.update();
        
        exportBtn.textContent = originalText;
        exportBtn.disabled = false;
    }
    
    // Add result to table
    addResult(result) {
        this.results.push(result);
        this.updateResultsTable();
    }
    
    // Update results table
    updateResultsTable() {
        const tbody = document.getElementById('results-tbody');
        tbody.innerHTML = '';
        
        this.results.forEach(result => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${result.parameter}</td>
                <td>${result.value}</td>
                <td>${result.avgQueue.toFixed(2)}</td>
                <td>${result.avgDelay.toFixed(2)}</td>
                <td>${result.theoreticalDelay === Infinity ? '∞' : result.theoreticalDelay.toFixed(2)}</td>
                <td>${result.throughput.toFixed(0)}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    // Export data
    exportData() {
        const data = {
            parameters: {
                lanesNorth: this.lanesNorth,
                lanesSouth: this.lanesSouth,
                lanesEast: this.lanesEast,
                lanesWest: this.lanesWest,
                greenTime: this.greenTime,
                bikePhase: this.bikePhase,
                T: this.T,
                A: this.A,
                lambda: this.lambda,
                capacity: this.capacity
            },
            simulationData: this.dataHistory,
            results: this.results,
            theoreticalDelay: this.calculateTheoreticalDelay(),
            saturationFlow: this.calculateSaturationFlow()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `traffic-simulation-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // Export charts as images
    exportCharts() {
        if (!this.queueChart || !this.delayChart) {
            alert('Charts not initialized. Please run the simulation first.');
            return;
        }
        
        const queueUrl = this.queueChart.toBase64Image('image/png', 1.0);
        const queueLink = document.createElement('a');
        queueLink.href = queueUrl;
        queueLink.download = `queue-chart-${Date.now()}.png`;
        document.body.appendChild(queueLink);
        queueLink.click();
        document.body.removeChild(queueLink);
        
        setTimeout(() => {
            const delayUrl = this.delayChart.toBase64Image('image/png', 1.0);
            const delayLink = document.createElement('a');
            delayLink.href = delayUrl;
            delayLink.download = `delay-chart-${Date.now()}.png`;
            document.body.appendChild(delayLink);
            delayLink.click();
            document.body.removeChild(delayLink);
        }, 100);
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Lane controls
        document.getElementById('lanes-north').addEventListener('input', (e) => {
            this.lanesNorth = parseInt(e.target.value);
            document.getElementById('lanes-north-value').textContent = this.lanesNorth;
            this.initialize();
        });
        
        document.getElementById('lanes-south').addEventListener('input', (e) => {
            this.lanesSouth = parseInt(e.target.value);
            document.getElementById('lanes-south-value').textContent = this.lanesSouth;
            this.initialize();
        });
        
        document.getElementById('lanes-east').addEventListener('input', (e) => {
            this.lanesEast = parseInt(e.target.value);
            document.getElementById('lanes-east-value').textContent = this.lanesEast;
            this.initialize();
        });
        
        document.getElementById('lanes-west').addEventListener('input', (e) => {
            this.lanesWest = parseInt(e.target.value);
            document.getElementById('lanes-west-value').textContent = this.lanesWest;
            this.initialize();
        });
        
        // Other controls
        document.getElementById('green-time').addEventListener('input', (e) => {
            this.greenTime = parseFloat(e.target.value);
            document.getElementById('green-time-value').textContent = this.greenTime;
        });
        
        document.getElementById('bike-phase').addEventListener('input', (e) => {
            this.bikePhase = parseFloat(e.target.value);
            document.getElementById('bike-phase-value').textContent = this.bikePhase;
        });
        
        document.getElementById('T').addEventListener('input', (e) => {
            this.T = parseFloat(e.target.value);
            document.getElementById('T-value').textContent = this.T.toFixed(1);
        });
        
        document.getElementById('A').addEventListener('input', (e) => {
            this.A = parseFloat(e.target.value);
            document.getElementById('A-value').textContent = this.A.toFixed(1);
        });
        
        document.getElementById('lambda').addEventListener('input', (e) => {
            this.lambda = parseFloat(e.target.value);
            document.getElementById('lambda-value').textContent = this.lambda;
        });
        
        document.getElementById('capacity').addEventListener('input', (e) => {
            this.capacity = parseFloat(e.target.value);
            document.getElementById('capacity-value').textContent = this.capacity;
        });
        
        document.getElementById('dt').addEventListener('input', (e) => {
            this.dt = parseFloat(e.target.value);
            document.getElementById('dt-value').textContent = this.dt.toFixed(1);
        });
        
        // Buttons
        document.getElementById('start-btn').addEventListener('click', () => {
            this.start();
        });
        
        document.getElementById('stop-btn').addEventListener('click', () => {
            this.stop();
        });
        
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.reset();
        });
        
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportData();
        });
        
        document.getElementById('sweep-lambda-btn').addEventListener('click', async () => {
            await this.runLambdaSweep();
        });
        
        document.getElementById('sweep-T-btn').addEventListener('click', async () => {
            await this.runTSweep();
        });
        
        document.getElementById('sweep-green-btn').addEventListener('click', async () => {
            await this.runGreenTimeSweep();
        });
        
        document.getElementById('export-charts-btn').addEventListener('click', () => {
            this.exportCharts();
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.draw();
        });
    }
}

// Initialize simulation when page loads
let simulation;
window.addEventListener('DOMContentLoaded', () => {
    simulation = new TrafficSimulation();
});

