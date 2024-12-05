/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Comlink from 'comlink'
import { useEffect, useRef, useState } from 'react'
import type { MupdfWorker } from '../workers/mupdf.worker'

// Initialize the worker and wrap it with Comlink
const worker = new Worker(new URL('../workers/mupdf.worker', import.meta.url), { type: 'module' })
const mupdfWorker = Comlink.wrap<MupdfWorker>(worker)

export function useMupdf() {
  const [workerInitialized, setWorkerInitialized] = useState(false)
  const documentRef = useRef<ArrayBuffer | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => {
    // Listen for the worker initialization message
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data === 'MUPDF_LOADED') {
        setWorkerInitialized(true)
      }
    }

    worker.addEventListener('message', handleWorkerMessage)

    return () => {
      worker.removeEventListener('message', handleWorkerMessage)
    }
  }, [])

  const loadDocument = async (arrayBuffer: ArrayBuffer) => {
    documentRef.current = arrayBuffer
    return mupdfWorker.loadDocument(arrayBuffer)
  }

  const loadBookmarks = async () => {
    if (!documentRef.current) throw new Error('Document not loaded')
    return mupdfWorker.loadBookmarks()
  }

  const addBookmark = async (number = 0, title: string, parent: string) => {
    if (!documentRef.current) throw new Error('Document not loaded')
    return mupdfWorker.addBookmark(number, title, parent)
  }

  const getBlocks = async (number = 0) => {
    if (!documentRef.current) throw new Error('Document not loaded')
    return mupdfWorker.getBlocks(number)
  }

  const updateText = async (pageNumber = 0, block: any, text: string) => {
    if (!documentRef.current) throw new Error('Document not loaded')
    return mupdfWorker.updateText(pageNumber, block, text)
  }

  const merge = async (file: ArrayBuffer, pageNumber = 0) => {
    if (!documentRef.current) throw new Error('Document not loaded')
    return mupdfWorker.merge(file, pageNumber)
  }

  const AddAnnotations = async (pageNumber = 0, text: string) => {
    if (!documentRef.current) throw new Error('Document not loaded')
    return mupdfWorker.AddAnnotations(pageNumber, text)
  }

  const AddHighlight = async (pageNumber = 0, block: any) => {
    if (!documentRef.current) throw new Error('Document not loaded')
    return mupdfWorker.AddHighlight(pageNumber, block)
  }

  const getDocument = async () => {
    if (!documentRef.current) throw new Error('Document not loaded')
    return mupdfWorker.getDocument()
  }

  const renderPage = async (pageIndex: number) => {
    if (!documentRef.current) throw new Error('Document not loaded')
    setCurrentPage(pageIndex)
    return mupdfWorker.renderPageAsImage(pageIndex, (window.devicePixelRatio * 96) / 72)
  }

  return {
    workerInitialized,
    loadDocument,
    AddHighlight,
    getDocument,
    merge,
    AddAnnotations,
    updateText,
    loadBookmarks,
    getBlocks,
    addBookmark,
    renderPage,
    currentPage,
  }
}
