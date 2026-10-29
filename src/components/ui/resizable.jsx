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

const ResizablePanelGroup = ({
  className,
  direction,
  orientation,
  onLayout,
  onLayoutChange,
  ...props
}) => {
  const resolved = orientation ?? direction ?? "horizontal"
  return (
    <OrientationContext.Provider value={resolved}>
      <ResizablePrimitive.Group
        orientation={resolved}
        data-panel-group-direction={resolved}
        onLayoutChange={(layout) => {
          onLayoutChange?.(layout)
          onLayout?.(Object.values(layout))
        }}
        className={cn("flex h-full w-full", resolved === "vertical" && "flex-col", className)}
        {...props} />
    </OrientationContext.Provider>
  )
}

const ResizablePanel = ({ defaultSize, minSize, maxSize, collapsedSize, onResize, ...props }) => (
  <ResizablePrimitive.Panel
    defaultSize={asPercent(defaultSize)}
    minSize={asPercent(minSize)}
    maxSize={asPercent(maxSize)}
    collapsedSize={asPercent(collapsedSize)}
    onResize={onResize ? (size, id, prev) => onResize(size.asPercentage, prev?.asPercentage, id) : undefined}
    {...props} />
)

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
