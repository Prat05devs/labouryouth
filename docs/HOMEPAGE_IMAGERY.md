# Homepage imagery and motion

Created 4 October 2026 using the built-in image generation tool. These are fictional, photorealistic scenes of Indian adults, not real workers, listings or customer endorsements. The earlier illustrated variants were discarded after owner feedback and are not used by either app.

## Assets

Web: `apps/web/public/img/work-craft.webp`, `work-events.webp`, `work-home.webp` (1200 x 800). Mobile: `apps/mobile/assets/work/craft.jpg`, `events.jpg`, `home.jpg` (800 x 533). Optimized derivatives preserve the complete composition. Originals remain in the generator's output directory.

## Motion references

- https://www.awwwards.com/inspiration/hero-animation-baguette-studio : entrance and editorial hero reference.
- https://www.awwwards.com/inspiration/hero-animation-destigmatize : photo-led hero reference.
- https://gsap.com/docs/v3/Plugins/ScrollTrigger/ : layered scroll motion reference. Implementation uses CSS, requestAnimationFrame and native Web Animations, with no added animation dependency.
- https://reactnative.dev/docs/animated : native-driver transforms and opacity for Expo.

## Final generation prompts

### craft-photo

Use case: photorealistic-natural. Asset type: production homepage editorial work photography for Labour Youth. Scene: Two adult Indian carpenters, woman and man aged about 30, measuring a wooden window frame at a tidy working carpentry shop in Dehradun. Both have distinctly Indian faces, natural brown skin, protective glasses, practical charcoal work shirts. Focus on skilled hands and attentive faces, real woodworking tools, modest local homes beyond an open doorway. Ultra realistic high-end documentary photograph, absolutely NOT illustration, NOT painting, NOT 3D, NOT stylized. Authentic Indian people only. Natural skin pores and fine hair, anatomically accurate hands and fingers, real fabric texture, believable task and tools, slight environmental imperfections. Warm natural window or afternoon light, subtle film-like editorial colour grade in ivory, charcoal, brass and muted green. Shot on a full-frame camera, 50mm lens, f/4, natural depth of field, precise focus on faces and task. Landscape 3:2 crop, keep faces and task in central 75 percent for responsive web and mobile crop. No words, no branding, no logos, no badges, no watermarks. Fictional representative scene, not a real customer testimonial.

### events-photo

Use case: photorealistic-natural. Asset type: production homepage editorial work photography for Labour Youth. Scene: Two Indian event staff, woman and man in their mid-twenties with Indian faces and natural brown skin, setting tables for a small outdoor community celebration in Dehradun. One aligns a tablecloth while the other arranges a chair. Clean simple ivory shirts and charcoal aprons, local foothill garden venue. Actual everyday work, not a luxury resort, no looking at the camera. Ultra realistic high-end documentary photograph, absolutely NOT illustration, NOT painting, NOT 3D, NOT stylized. Authentic Indian people only. Natural skin pores and fine hair, anatomically accurate hands and fingers, real fabric texture, believable task and tools, slight environmental imperfections. Warm natural window or afternoon light, subtle film-like editorial colour grade in ivory, charcoal, brass and muted green. Shot on a full-frame camera, 50mm lens, f/4, natural depth of field, precise focus on faces and task. Landscape 3:2 crop, keep faces and task in central 75 percent for responsive web and mobile crop. No words, no branding, no logos, no badges, no watermarks. Fictional representative scene, not a real customer testimonial.

### home-photo

Use case: photorealistic-natural. Asset type: production homepage editorial work photography for Labour Youth. Scene: An Indian woman household professional aged 35 and an Indian woman homeowner aged 40 with distinctly Indian faces and natural brown skin, discussing a notebook together at a kitchen counter in a modest bright contemporary Indian home. Professional wears a plain charcoal apron. Both at equal eye level, approachable candid expressions. Task planning and mutual respect, no children or stereotypes. Ultra realistic high-end documentary photograph, absolutely NOT illustration, NOT painting, NOT 3D, NOT stylized. Authentic Indian people only. Natural skin pores and fine hair, anatomically accurate hands and fingers, real fabric texture, believable task and tools, slight environmental imperfections. Warm natural window or afternoon light, subtle film-like editorial colour grade in ivory, charcoal, brass and muted green. Shot on a full-frame camera, 50mm lens, f/4, natural depth of field, precise focus on faces and task. Landscape 3:2 crop, keep faces and task in central 75 percent for responsive web and mobile crop. No words, no branding, no logos, no badges, no watermarks. Fictional representative scene, not a real customer testimonial.


## Actual app preview, 5 October 2026

`app-preview-en.webp` and `app-preview-hi.webp` are actual guest-home viewport captures from the Expo web export, taken with browser device emulation at 440 x 956 CSS pixels. They are resized to 880 x 1912 and compressed to WebP without altering interface content. No job data was injected. They show the top of the guest screen; the local API was unavailable during capture. These are web-rendered app screens, not native-device certification. Recapture them when the guest UI changes.
