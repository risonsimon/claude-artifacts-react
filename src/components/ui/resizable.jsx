import * as React from "react"
import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

// Claude writes this component against react-resizable-panels 2, where sizes are
// percentages and the group takes `direction`. Version 4 treats numbers as pixels
// and takes `orientation`, so translate the old API here.
const OrientationContext = React.createContext("horizontal")

function asPercent(value) {
  return typeof value === "number" ? `${value}%` : value
}

// `ref` gets the version 2 imperative API (percentage arrays and numbers) so
// Claude's code that calls getLayout(), setLayout(), resize() or collapse() still works.
const ResizablePanelGroup = ({
  className,
  direction,
  orientation,
  onLayout,
  onLayoutChange,
  ref,
  groupRef,
  elementRef,
  ...props
}) => {
  const resolved = orientation ?? direction ?? "horizontal"
  const innerRef = React.useRef(null)
  const elementInnerRef = React.useRef(null)
  React.useImperativeHandle(groupRef, () => innerRef.current, [])
  React.useImperativeHandle(elementRef, () => elementInnerRef.current, [])

  // Layouts are keyed by panel id, and object key order is not panel order
  // (numeric-looking ids sort first), so read the order from the DOM.
  const panelIds = React.useCallback((layout) => {
    const group = elementInnerRef.current
    const ids = group
      ? [...group.querySelectorAll("[data-panel]")]
          .filter((el) => el.closest("[data-group]") === group)
          .map((el) => el.id)
          .filter((id) => id in layout)
      : []
    return ids.length === Object.keys(layout).length ? ids : Object.keys(layout)
  }, [])
  const toArray = React.useCallback((layout) => panelIds(layout).map((id) => layout[id]), [panelIds])

  React.useImperativeHandle(ref, () => ({
    getId: () => props.id,
    getLayout: () => toArray(innerRef.current?.getLayout() ?? {}),
    setLayout: (sizes) => {
      const ids = panelIds(innerRef.current?.getLayout() ?? {})
      innerRef.current?.setLayout(Object.fromEntries(ids.map((id, index) => [id, sizes[index]])))
    },
  }), [props.id, panelIds, toArray])
  return (
    <OrientationContext.Provider value={resolved}>
      <ResizablePrimitive.Group
        groupRef={innerRef}
        elementRef={elementInnerRef}
        orientation={resolved}
        data-panel-group-direction={resolved}
        onLayoutChange={(layout) => {
          onLayoutChange?.(layout)
          onLayout?.(toArray(layout))
        }}
        className={cn("flex h-full w-full", resolved === "vertical" && "flex-col", className)}
        {...props} />
    </OrientationContext.Provider>
  )
}

const ResizablePanel = ({ defaultSize, minSize, maxSize, collapsedSize, onResize, ref, panelRef, id, ...props }) => {
  const autoId = React.useId()
  const panelId = id ?? autoId
  const innerRef = React.useRef(null)
  React.useImperativeHandle(panelRef, () => innerRef.current, [])
  React.useImperativeHandle(ref, () => ({
    collapse: () => innerRef.current?.collapse(),
    expand: () => innerRef.current?.expand(),
    getId: () => String(panelId),
    getSize: () => innerRef.current?.getSize().asPercentage ?? 0,
    isCollapsed: () => innerRef.current?.isCollapsed() ?? false,
    isExpanded: () => !(innerRef.current?.isCollapsed() ?? false),
    resize: (size) => innerRef.current?.resize(asPercent(size)),
  }), [panelId])
  return (
    <ResizablePrimitive.Panel
      id={panelId}
      panelRef={innerRef}
      defaultSize={asPercent(defaultSize)}
      minSize={asPercent(minSize)}
      maxSize={asPercent(maxSize)}
      collapsedSize={asPercent(collapsedSize)}
      onResize={onResize ? (size, id, prev) => onResize(size.asPercentage, prev?.asPercentage, id) : undefined}
      {...props} />
  )
}

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}) => {
  const vertical = React.useContext(OrientationContext) === "vertical"
  return (
    <ResizablePrimitive.Separator
      data-panel-group-direction={vertical ? "vertical" : "horizontal"}
      className={cn(
        "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1",
        vertical &&
          "h-px w-full after:left-0 after:h-1 after:w-full after:-translate-y-1/2 after:translate-x-0 [&>div]:rotate-90",
        className
      )}
      {...props}>
      {withHandle && (
        <div
          className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
          <GripVertical className="h-2.5 w-2.5" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
