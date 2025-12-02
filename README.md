# Signalized Intersection Simulation for SJNY Math Undergraduate Final Project
author(s): Bardh Ademi, Manas Bhandari

This repository accompanies the paper *Modeling the Formation of Vehicle Congestion at a Signalized Intersection*. It contains three artefacts:

- `traffic-simulation.html` – a single-file HTML5/Canvas implementation of the microscopic + macroscopic model described in Sections 3–5 of the paper.
- `results-discussion.tex` – the written discussion of validation experiments and sensitivity studies that reference the HTML simulation.
- `README.md` – this document.

## Running the simulation

1. Download or clone the repository.
2. Open `traffic-simulation.html` in any modern desktop browser (Chrome, Edge, Firefox, Safari). No build tools are required.
3. Use the **Model Parameters** sliders on the left to adjust:
   - Reaction delay, sensitivity, car speed, and Poisson arrival rates.
   - Total arrivals (aggregated veh/min across all approaches).
   - Cycle-length scaling (expands/contracts the 10s+5s+10s+5s phase plan from the paper).
   - Animation speed (1× or 2× playback).
4. The canvas shows the 12-lane geometry from Fig. 2 of the paper with fixed turning rules. Signal heads on each approach indicate the current phase, and vehicle motion respects the delayed car-following model (Eq. 1) and saturation-flow headways (Eqs. 2–4).
5. Below the canvas you will find live metrics (queue length, average delay, throughput) that update every simulation tick, as well as the theoretical curves from Eq. 8 for quick comparison.

Because everything runs in the browser, you can pause, resume, or reset the model instantly to explore different scenarios. No data is persisted; exporting plots can be done via your browser’s “Save image” or screenshot utilities.

## Updating the paper

`results-discussion.tex` references the same defaults that ship in the HTML file (10+5+10+5 second cycle, 1.0 s reaction delay, 10 m/s car speed, 20 veh/min/approach). When you modify figures or tables, rerun the simulation with the matching settings so that the textual discussion and screenshots stay aligned.

## License / Attribution

Please cite the original MAT 471 project paper if you use this simulator or the accompanying analysis in academic work. The code is intentionally self-contained so it can be shared alongside the PDF without additional tooling.
