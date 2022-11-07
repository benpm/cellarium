# What are we doing?
## Control & UI Changes
- Add a new [`ui-button-toggle`](/src/components/UIButtonToggle.vue) indicating whether we're rendering states or paints - "`Sim.renderStatesElsePaints`"
- Tie `Sim.renderStatesElsePaints` into [`Sim`](/src/sim.ts)'s declaration.

## Render & Sim Changes
0. Construct a texture of RGB values ('paints') to associate with each cell.
    - Explicitly RGB
    - How to construct?
        - Random
        - From an image
1. Run a simulation according to the existing systems.
2. After simulation, compute new paints for each cell.
    - If the cell changed state,
        - Assign a new paint by averaging the paints of its neighbors which *had* the state it now *has*.
    - Otherwise, keep its paint.
3. Colormap to the output
    - `if Sim.renderStatesElsePaints:`
        - Render 'normally', eg use states
    - `else:`
        - Render paints