### container

takes an array of tags { name:string, id:number, color?:string (hexcode) }
should allow to style certain tags as "solid", "outlined", "border-dashed"
maybe handled with arrays of ids as props
this will most likely only going to be used to display that some tags belong to "all elements" or "some elements"
`all items` - displayed first, separately from the `some items`
all - outlined, some - border-dashed

### chips

pretty sure we should write our own and not use primevue Chips
styles: "solid", "outlined", "border-dashed"
remove icon that appears on hover
is selectable (has the solid style)
is editable: turns into an inline input field, doesn't have any of the fancy autocomplete, just simple input that emits on submit, and cancels on blur / escape

### input

write a new input, similiar to EditorTagInput.vue
option props:

- autocomplete - if present uses the tagStore for autocomplete
- typahead - enables typahead
- dropdown direction: (up, down)

just like EditorTagInput.vue filters out the tags that are already inside container

but unlike EditorTagInput.vue it doesn't render chips, on delimiter (',' or ' ') immediately submits

### style - look

container: rounded card, chips rendered with flex-wrap gap-1
chips: rounded,

inline option prop:
tags are in a flex-row not flex-wrap, overflow-x-auto, always leave space for the input (sticky on the right)

### functionality / how its used

- takes props: allItemsTags, someItemsTags
- emits the edit add remove etc. events
- when it detects ctrl+c while tags are selected copy their names into a "tag1, tag2" format (join with ,)
- when a tag is selected (mousedown with shift) unfocus the tag input
