import * as React from 'react';
import GjsEditor, {
    AssetsProvider,
    Canvas,
    ModalProvider,
} from '@grapesjs/react';
import { grapesjs, type Editor, type EditorConfig } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css'

const gjsOptions: EditorConfig = {
    height: '100dvh',
    storageManager: {
        type: 'local',
        autosave: true,
        autoload: true,
        stepsBeforeSave: 1,
        options: {
            local: {
                key: 'gjs'
            }
        }
    },
    undoManager: { 
        trackSelection: true,
        maximumStackLength: 50
    },
    selectorManager: { componentFirst: true },
    plugins: []
}

export default function PageEditor() {
    const onEditor = (editor: Editor) => {
        (window as any).editor = editor;
    }

    return (
        <GjsEditor
            className='gjs-editor-root'
            grapesjs={grapesjs}
            options={gjsOptions}
        >

        </GjsEditor>
    )
};