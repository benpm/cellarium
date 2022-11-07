# The problem
Computers spend time. Some of the time is spent preparing to work, some is spent speculating on what work needs done, some is spent doing work that isn't necessary, and some is spent doing work that is necessary.

If I'm instructing the GPU to switch between [rendering paints and states](/documents/Goals.md#render--sim-changes), there are 3 main options to do that:
1. Write entirely separate shaders
    - It's entirely likely the GPU spends a ton of time changing out the shader it uses.
        - I don't plan on switching them out often
    - This radically violates the DRY principle.
2. Write a conditional inside [colormap.glsl](/src/shaders/colormap.glsl)
    - It's entirely possible the GPU uses branch prediction, which have performance penalties for conditional jumps
        - If it works poorly, this might have a branch-miss on *every* pixel.
        - If it works anything better than awful, this should never branch-miss.
    - This requires shipping more textures to the shader than is *strictly* necessary
        - But maybe those textures already live on the GPU and aren't costly to include-but-not-use
        - And maybe I have to ship both anyway to handle the mouse input
3. Render both paints and states, then switch-multiply them
    - This invites a ton of execution and memory access which is entirely unnecessary


# My decision
I like option 2. It joins common concerns and keeps DRY; it trades less work on the GPU PCI-e bus for the best-case scenario of needing a good branch predictor; and, while I can only speculate, it's probably not terrible to just *include* a texture you don't actually *use*.

If performance tanks, I'll be back.
