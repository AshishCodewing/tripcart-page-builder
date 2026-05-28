import { useEditorMaybe } from '@grapesjs/react';
import { createPortal } from 'react-dom';
import { useEffect, useState, useRef } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useTransitionStyles,
} from '@floating-ui/react';
import { Copy, Trash2, ArrowUp, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from '@/components/ui/button-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function FloatingToolbar() {
  const editor = useEditorMaybe();
  const [spotsEl, setSpotsEl] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<any>(null);

  const virtualRef = useRef({
    getBoundingClientRect: () => ({
      x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0,
      toJSON() { return this; },
    }),
  });

  const { refs, floatingStyles, context } = useFloating({
    open: !!selected,
    placement: 'top-end',
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ['bottom-start', 'top-start', 'bottom-end', 'left'] }),
      shift({ padding: 8, mainAxis: true, crossAxis: true }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: 150,
  });

  useEffect(() => {
    if (!editor) return;

    const updateRect = () => {
      const cmp = editor.getSelected();
      const el = cmp?.getEl();
      const frame = editor.Canvas.getFrameEl?.();
      if (!el || !frame) return;
      virtualRef.current.getBoundingClientRect = () => {
        const elRect = el.getBoundingClientRect();
        const frameRect = frame.getBoundingClientRect();
        return new DOMRect(
          elRect.x + frameRect.x,
          elRect.y + frameRect.y,
          elRect.width,
          elRect.height,
        );
      };
      refs.setPositionReference(virtualRef.current);
    };

    const onLoad = () => setSpotsEl(editor.Canvas.getSpotsEl() ?? null);
    const onSelect = (cmp: any) => {
      setSelected(cmp);
      requestAnimationFrame(updateRect);
    };
    const onDeselect = () => setSelected(null);
    const onUpdate = () => updateRect();
    const onRemove = (cmp: any) => {
      setSelected((current: any) => (current === cmp ? null : current));
    };

    editor.on('load', onLoad);
    editor.on('component:selected', onSelect);
    editor.on('component:deselected', onDeselect);
    editor.on('component:remove', onRemove);
    editor.on('component:update canvas:update', onUpdate);

    const frameEl = editor.Canvas.getFrameEl?.();
    frameEl?.contentWindow?.addEventListener('scroll', onUpdate, true);

    return () => {
      editor.off('load', onLoad);
      editor.off('component:selected', onSelect);
      editor.off('component:deselected', onDeselect);
      editor.off('component:remove', onRemove);
      editor.off('component:update canvas:update', onUpdate);
      frameEl?.contentWindow?.removeEventListener('scroll', onUpdate, true);
    };
  }, [editor, refs]);

  if (!editor || !spotsEl || !isMounted || !selected) return null;

  return createPortal(
    <div
      ref={refs.setFloating}
      style={{ ...floatingStyles, ...transitionStyles, pointerEvents: 'auto' }}
    >
      <TooltipProvider delay={300}>
        <ButtonGroup className="rounded-md bg-primary shadow-lg">
          <ButtonGroupText className="border-0 bg-transparent px-2 text-xs font-medium text-primary-foreground max-w-36 overflow-hidden text-ellipsis whitespace-nowrap">                                                                                                                                                      
            {selected.getName()}
          </ButtonGroupText>
          <ButtonGroupSeparator className="bg-primary-foreground/10" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-white"
                  onClick={() => editor.runCommand('tlb-move')}
                >
                  <Move className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <TooltipContent>Move</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-white"
                  onClick={() => {
                    const parent = selected.parent();
                    if (parent) editor.select(parent);
                  }}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <TooltipContent>Select parent</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-white"
                  onClick={() => {
                    const parent = selected.parent();
                    const idx = selected.index();
                    parent?.append(selected.clone(), { at: idx + 1 });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <TooltipContent>Duplicate</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-white"
                  onClick={() => selected.remove()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      </TooltipProvider>
    </div>,
    spotsEl
  );
}