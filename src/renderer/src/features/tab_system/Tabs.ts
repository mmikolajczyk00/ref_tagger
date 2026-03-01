enum AppTabType {
  Empty,
  Canvas,
  TagEditor
}

class AppTab {
  title: string = 'untitled'
  id: number
  tabType: AppTabType = AppTabType.Empty

  constructor(id: number, title?: string) {
    this.id = id

    if (title) this.title = title
  }
}

class EmptyTab extends AppTab {
  tabType = AppTabType.Empty
}

class TagEditorTab extends AppTab {
  tabType = AppTabType.TagEditor
}

class CanvasEditorTab extends AppTab {
  tabType = AppTabType.Canvas
}

export { AppTab, AppTabType, EmptyTab, TagEditorTab, CanvasEditorTab }
