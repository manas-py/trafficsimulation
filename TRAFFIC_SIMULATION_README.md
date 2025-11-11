# Traffic Intersection Simulation

## Overview

This is a 4-way intersection simulation based on the matrix model from the research paper "Modeling the Formation of Vehicle Congestion at a Signalized Intersection" (MAT 471). The simulation implements the matrix recursion:

**x_{t+Δt} = x_t + A_t - S_t**

where:
- **x_t** is the vector of queue lengths for each lane in each direction
- **A_t** is the vector of Poisson-distributed arrivals
- **S_t** is the service vector (vehicles discharged), dependent on signal phase

## Features

### 4-Way Intersection
- **Four directions**: North, South, East, West
- **Adjustable lanes**: 1-4 lanes per direction (independent control)
- **Signal phases**: 
  - Phase 1: North-South green, East-West red
  - Phase 2: East-West green, North-South red
  - Phase 3: All red (bike phase - 15 seconds)

### Interactive Controls
- **Lanes per Direction**: Separate sliders for North, South, East, West (1-4 lanes each)
- **Green Time per Direction**: Signal green phase duration (5-120 seconds)
- **Bike Phase**: All-red phase duration for bike passing (0-60 seconds)
- **Reaction Delay T**: Driver reaction delay (0.5-3.0 seconds)
- **Sensitivity A**: Driver sensitivity parameter (0.1-2.0 s⁻¹)
- **Arrival Rate λ**: Vehicle arrival rate (1-60 veh/min)
- **Max Cars per Lane**: Capacity constraint (10-200 vehicles)
- **Time Step Δt**: Simulation time step (0.1-2.0 seconds)

### Simulation Features
- Real-time visualization of queue lengths per lane per direction
- Signal phase indicator showing which directions are green/red
- Live statistics: total queue, average delay, throughput, theoretical delay
- Queue length vs. time chart
- Parameter sweep analysis (λ, T, Green Time)
- Comparison with theoretical delay formula
- Data export (JSON format)
- Chart export (PNG images)

### Mathematical Models

The simulation implements:
1. **Car-following delay model** (Equation 1)
2. **Start-up lost time** (Equation 2)
3. **Headway and capacity** (Equations 3-4)
4. **Poisson vehicle arrivals** (Equation 5)
5. **Queue and delay dynamics** (Equations 6-8)
6. **Matrix representation** (Equation 9)

## Usage

### Running the Simulation

1. Open `traffic-simulation.html` in a web browser
2. Adjust parameters using the controls panel
3. Click "Start" to begin the simulation
4. Observe the real-time visualization and statistics
5. Click "Stop" to pause the simulation
6. Click "Reset" to clear the simulation state

### Traffic Cycle

The simulation follows a 3-phase cycle:
1. **North-South Green** (default: 30s): North and South directions have green light, East and West have red
2. **East-West Green** (default: 30s): East and West directions have green light, North and South have red
3. **Bike Phase** (default: 15s): All directions have red light for bike passing

The cycle repeats continuously. Total cycle length = (Green Time × 2) + Bike Phase.

### Parameter Sweeps

To analyze how parameters affect congestion:

1. **Sweep λ (Arrival Rate)**: Click "Sweep λ" to vary arrival rate from 5 to 50 veh/min
2. **Sweep T (Reaction Delay)**: Click "Sweep T" to vary reaction delay from 0.5 to 3.0 seconds
3. **Sweep Green Time**: Click "Sweep Green Time" to vary green time from 10 to 60 seconds

Each sweep:
- Runs the simulation for multiple parameter values
- Collects average delay, queue length, and throughput data
- Updates the delay chart with simulated vs. theoretical results
- Adds results to the summary table

### Data Export

- **Export Data**: Click "Export Data" to download simulation data as JSON
- **Export Charts**: Click "Export Charts" to download queue and delay charts as PNG images

## Results Interpretation

### Queue Length vs. Time
Shows the evolution of total queue length over time. Oscillations correspond to signal phases:
- Queue builds during red phase
- Queue clears during green phase
- Bike phase causes uniform queue buildup across all directions
- Stochastic fluctuations from Poisson arrivals

### Average Delay vs. Parameter
Compares simulated average delay with theoretical predictions:
- **Solid line**: Simulated delay
- **Dashed line**: Theoretical delay (Equation 8)
- Close agreement validates the model
- Discrepancies indicate stochastic effects or model limitations

### Results Table
Summarizes parameter sweeps with:
- Parameter name and value
- Average queue length
- Average delay (simulated)
- Theoretical delay
- Throughput

## Validation

The simulation validates against the theoretical delay formula:

**W = (r² / (2C)) * (1 + λ / (s - λ))**

where:
- **W**: Average delay per vehicle
- **r**: Red time = Green time + Bike phase
- **C**: Cycle length = (Green Time × 2) + Bike Phase
- **λ**: Arrival rate
- **s**: Saturation flow rate

Typical validation results show agreement within 5-10% for stable operating conditions.

## Technical Details

### Saturation Flow Calculation
1. Calculate start-up time: `t_roll = T + v_min / (A * v_0)`
2. Calculate headway: `h = t_roll + τ`
3. Calculate saturation flow: `s = 1 / h` (veh/s)
4. Convert to veh/h: multiply by 3600

### Poisson Arrivals
Arrivals follow a Poisson process:
- **P(Y = y) = (λ^y * e^(-λ)) / y!**
- Mean arrival rate: λ (veh per time interval)
- Stochastic fluctuations create natural queue variability
- Each direction and lane has independent arrival process

### Service Matrix
During green phase for a direction:
- **S_t = G * s * Δt**
- **G**: Diagonal matrix (1 for active lanes in green direction, 0 for others)
- **s**: Saturation flow per lane
- Service is limited by queue length and capacity
- During red or bike phase, service is zero

### Signal Timing
- **Cycle length**: C = 2g + b (where g = green time, b = bike phase)
- **Red time per direction**: r = g + b
- **Green time per direction**: g
- Each direction gets green for g seconds, then red for g + b seconds

## Files

- `traffic-simulation.html`: Main simulation interface
- `traffic-simulation.js`: Simulation logic and visualization
- `results-discussion.tex`: LaTeX document for Results & Discussion section
- `TRAFFIC_SIMULATION_README.md`: This file

## Dependencies

- Chart.js (loaded via CDN): For graph visualization
- Modern web browser with JavaScript enabled

## Browser Compatibility

Tested on:
- Chrome/Edge (recommended)
- Firefox
- Safari

## Notes

- Parameter sweeps may take 30-60 seconds to complete
- Simulation runs faster with larger time steps (Δt)
- For accurate results, run simulations for at least 300 seconds
- Theoretical delay formula assumes steady-state conditions
- Capacity constraints may affect results at high arrival rates
- Bike phase adds delay to all directions uniformly
- Queue patterns differ between directions due to alternating phases

## Example Scenarios

### Scenario 1: Balanced Traffic
- 2 lanes per direction
- Green time: 30s
- Bike phase: 15s
- Arrival rate: 20 veh/min
- Result: Moderate delays, stable queues

### Scenario 2: High Traffic
- 2 lanes per direction
- Green time: 30s
- Bike phase: 15s
- Arrival rate: 40 veh/min
- Result: High delays, queues near capacity

### Scenario 3: Optimized Timing
- 3 lanes per direction
- Green time: 45s
- Bike phase: 10s
- Arrival rate: 25 veh/min
- Result: Low delays, efficient throughput

## Future Enhancements

- Lane-changing behavior
- Turning movements (left/right turns)
- Adaptive signal control
- Connected/autonomous vehicle impacts
- Real intersection data calibration
- Multi-intersection networks
- Pedestrian phase modeling
- Actual bicycle traffic simulation

## References

1. Daganzo, C. F. (1994). The Cell Transmission Model: A Dynamic Representation of Highway Traffic Consistent with the Hydrodynamic Theory. Transportation Research Part B, 28(4), 269-287.

2. Storani, F., Di Pace, R., Bruno, F., & Fiori, C. (2021). Analysis and Comparison of Traffic Flow Models: A New Hybrid Traffic Flow Model vs Benchmark Models. European Transport Research Review, 13(58).

3. Schreckenberg, M., & Selten, R. (Eds.). (2004). Human Behaviour and Traffic Networks. Springer.

4. Treiber, M., & Kesting, A. (2013). Traffic Flow Dynamics: Data, Models and Simulation. Springer.

## Contact

For questions or issues with the simulation, please refer to the research paper or contact the author.

