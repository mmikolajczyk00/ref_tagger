# The Architecture Breakdown

    ### The Logic (useTagAutocomplete.ts): A composable that handles all the complex state: the current text, the calculated ghost text, the list of suggestions, and the up/down arrow index tracking. Integrated with the @useTagStore.ts

    ### The Base UI (BaseTagInput.vue): A "dumb" component that handles the visual illusion of chips inside an input, rendering the ghost text autocomplete, and firing standard events.

    ### The Wrappers (SearchTagInput.vue & EditorTagInput.vue): These components use the Base UI and the Composable, injecting their specific rules (e.g., the search wrapper parses - or * before feeding the string to the autocomplete).

        ##### SearchTagInput.vue parse logic:
        - '-' blacklisted tags, ignore the files that have them
        - '!' important tags, the files must include them
        - '*' wildcard - allows for searching by prefix or suffix
        - for now ignore searching logic, only focus on tag parsing

# Base UI Component (BaseTagInput.vue)

    contains a flex-wrapped list of selected tag chips and an inline text <input>.

    Ghost Text Overlay: Rendered right behind the <input> using two inline <span> tags—one invisible (opacity-0) containing the current typed string to match width, and one visible for ghostTextRemainder.

    Events & Navigation: Listens for keyboard inputs (Tab, Enter, Space, ,, Up, Down) and passes them off to the parent/composable handlers.

    Dropdown Slot: Displays an absolute-positioned <ul> list below or above (depending on props) the input box whenever suggestions.length > 0, highlighting the currently selected item.

2. Composable (useTagAutocomplete.ts)
State: Manages inputText, selectedIndex and ghost text.

    Search Matching: Queries the Pinia tagStore.getMatchingTags(query, excludeSet)

    Keyboard Navigation: Cycles selectedIndex through the suggestions array bounds using modulo arithmetic.

3. Editor Variant Component (EditorTagInput.vue)

    Wires Composable to Base Input: Connects BaseTagInput to useTagAutocomplete.
    Validation & Tag Creation:
        On Tab: Applies activeSuggestion
        On Enter: Creates a new tag if it doesn't exist yet.
        On Space or ',': Commits the typed text as a tag without completing the suggestion.

    Calls tagStore.addTagLocally(newTag) when a tag is created.

4. Search Variant Component (SearchTagInput.vue)

This wrapper will handle search-specific query syntax.

    Query Pre-Processing: Intercepts typed strings to handle prefixes/modifiers (e.g., stripping -, !, or * before querying useTagAutocomplete for the tag name).

    Emits Search AST/Filters: Converts applied chips into search rules (e.g., { required: [], excluded: ['nature'] }) to send to your SQLite search query builder.
