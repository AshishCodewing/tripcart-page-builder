import type {
  Component,
  ComponentDefinitionDefined,
  ContentType,
  CustomRendererProps,
  Editor,
  TraitProperties,
} from "grapesjs"
import type {
  ComponentType,
  CSSProperties,
  DetailedHTMLProps,
  HTMLAttributes,
  ReactElement,
  ReactNode,
  Ref,
} from "react"

declare module "grapesjs" {
  interface BlockProperties {
    content?: ContentType | (() => ContentType) | ReactElement
    /**
     * Stash for the original React element when `content` is JSX. The
     * processor replaces `content` with a plain GrapesJS definition; this
     * field preserves what the caller authored.
     */
    reactContent?: ReactElement
  }
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "gjs-wrapper": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
    }
  }
}

export const ErrorType = {
  NoPagesFound: "noPagesFound",
  PageNotFound: "pageNotFound",
  NoFramesFound: "noFramesFound",
  MissingRootComponent: "missingRootComponent",
  ComponentNotFound: "componentNotFound",
} as const
export type ErrorType = (typeof ErrorType)[keyof typeof ErrorType]

export type EditorRenderProps = (props: {
  props: Record<string, unknown>
  children: ReactNode
  editor: Editor
  component: Component
  connectDom: Ref<HTMLElement | null>
}) => ReactElement

export interface ComponentConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>
  allowPropId?: boolean
  allowPropClassName?: boolean
  allowChildren?: boolean
  props?: () => TraitProperties[]
  model?: ComponentDefinitionDefined
  wrapperStyle?: CSSProperties
  editorRender?: EditorRenderProps
}

export interface EditorProps {
  doc: Document
  editor: Editor
  frameView: CustomRendererProps["frameView"]
}

export interface WithEditorProps {
  editorProps?: EditorProps
}

export interface RootComponentProps extends WithEditorProps {
  children?: ReactNode
}

export interface RenderErrorProps extends RootComponentProps {
  errorType: ErrorType
}

export interface RendererReactOptions {
  components?: Record<string, ComponentConfig>
  errorComponent?: ComponentType<RenderErrorProps>
  rootComponent?: ComponentType<RootComponentProps>
  headAfter?: ComponentType<WithEditorProps>
  bodyAfter?: ComponentType<WithEditorProps>
}

export interface CustomRendererPropsWithConfig extends CustomRendererProps {
  config: RendererReactOptions
}
