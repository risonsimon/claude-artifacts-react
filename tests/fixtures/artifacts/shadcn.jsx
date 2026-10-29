import React, { useState } from "react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
  Alert, AlertDescription, AlertTitle,
  Badge, Button, Calendar,
  Card, CardContent, CardHeader, CardTitle,
  Carousel, CarouselContent, CarouselItem,
  Checkbox, Input, Label, Progress,
  ResizableHandle, ResizablePanel, ResizablePanelGroup,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Slider, Switch, Tabs, TabsContent, TabsList, TabsTrigger,
  Textarea, Toaster, SonnerToaster,
} from "@/components/ui";

export default function Shadcn() {
  const [date, setDate] = useState(new Date(2025, 0, 15));
  const [sizes, setSizes] = useState([]);
  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader><CardTitle>Shadcn fixture</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Alert><AlertTitle>Heads up</AlertTitle><AlertDescription>Alert works</AlertDescription></Alert>
          <Badge>Badge</Badge>
          <Button>Button</Button>
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="Name" />
          <Textarea placeholder="Notes" />
          <Checkbox aria-label="check" />
          <Switch aria-label="switch" />
          <Slider defaultValue={[50]} max={100} step={1} />
          <Progress value={40} />
          <Select defaultValue="b">
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="a">Alpha</SelectItem><SelectItem value="b">Beta</SelectItem></SelectContent>
          </Select>
          <Tabs defaultValue="one">
            <TabsList><TabsTrigger value="one">One</TabsTrigger><TabsTrigger value="two">Two</TabsTrigger></TabsList>
            <TabsContent value="one">Tab one content</TabsContent>
            <TabsContent value="two">Tab two content</TabsContent>
          </Tabs>
          <Accordion type="single" collapsible>
            <AccordionItem value="a"><AccordionTrigger>Question</AccordionTrigger><AccordionContent>Answer</AccordionContent></AccordionItem>
          </Accordion>
          <Carousel><CarouselContent><CarouselItem>Slide 1</CarouselItem><CarouselItem>Slide 2</CarouselItem></CarouselContent></Carousel>
        </CardContent>
      </Card>
      <Calendar mode="single" selected={date} onSelect={setDate} defaultMonth={new Date(2025, 0, 1)} initialFocus />
      <p data-testid="selected-date">{date ? date.toDateString() : "none"}</p>
      <div style={{ width: 400, height: 120 }}>
        <ResizablePanelGroup direction="horizontal" onLayout={setSizes} className="rounded border">
          <ResizablePanel defaultSize={30}><div className="p-2">Left</div></ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={70}><div className="p-2">Right</div></ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <p data-testid="sizes">{sizes.map((size) => Math.round(size)).join(",")}</p>
      <Toaster />
      <SonnerToaster />
    </div>
  );
}
