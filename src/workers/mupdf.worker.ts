/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference lib="webworker" />
import * as Comlink from 'comlink'

export const MUPDF_LOADED = 'MUPDF_LOADED'

const mupdfScript = import.meta.env.PROD ? '/assets/mupdf.js' : '/node_modules/mupdf/dist/mupdf.js'

export class MupdfWorker {
  private mupdf?: any
  private document?: any

  constructor() {
    this.initializeMupdf()
  }

  private async initializeMupdf() {
    try {
      // Dynamically import the MuPDF library
      const mupdfModule = await import(/* @vite-ignore */ mupdfScript)
      this.mupdf = mupdfModule
      postMessage(MUPDF_LOADED) // Notify the main thread that MuPDF is ready
    } catch (error) {
      console.error('Failed to initialize MuPDF:', error)
    }
  }

  async loadDocument(document: ArrayBuffer): Promise<boolean> {
    if (!this.mupdf) throw new Error('MuPDF not initialized')
    try {
      this.document = this.mupdf.Document.openDocument(document, 'application/pdf')
      return true
    } catch (error) {
      console.error('Error loading document:', error)
      throw new Error('Failed to load document')
    }
  }

  async renderPageAsImage(pageIndex = 0, scale = 1): Promise<Uint8Array> {
    if (!this.mupdf || !this.document) throw new Error('Document not loaded')
    try {
      const page = this.document.loadPage(pageIndex)
      const pixmap = page.toPixmap([scale, 0, 0, scale, 0, 0], this.mupdf.ColorSpace.DeviceRGB)
      return pixmap.asPNG()
    } catch (error) {
      console.error('Error rendering page:', error)
      throw new Error('Failed to render page')
    }
  }

  async loadBookmarks(): Promise<any[]> {
    if (!this.mupdf) throw new Error('MuPDF not initialized')
    try {
      return this.document.loadOutline() || []
    } catch (error) {
      console.error('Error loading bookmarks:', error)
      throw new Error('Failed to load bookmarks')
    }
  }

  async addBookmark(number = 0, title: string, parent: string): Promise<any[]> {
    if (!this.mupdf) throw new Error('MuPDF not initialized')
    try {
      const outlineIterator = this.document.outlineIterator();

      if (parent) {
        while (outlineIterator.item().title !== parent) outlineIterator.next()
        outlineIterator.down()
      }

      outlineIterator.insert({
        title,
        uri: this.document.formatLinkURI({ page: number, type: 'XYZ', y: 0 }),
        page: number,
        open: false
      });
      return await this.loadBookmarks()
    } catch (error) {
      console.error('Error adding bookmark:', error)
      throw new Error('Failed to adding bookmark')
    }
  }

  async getBlocks(number = 0): Promise<[]> {
    if (!this.mupdf) throw new Error('MuPDF not initialized')
    try {
      const page = this.document.loadPage(number)
      const json = JSON.parse(page.toStructuredText("preserve-whitespace").asJSON()).blocks
      json.sort((a: { bbox: { y: number; x: number } }, b: { bbox: { y: number; x: number } }) => {
        if (a.bbox.y === b.bbox.y) {
          return b.bbox.x - a.bbox.x;
        }
        return a.bbox.y - b.bbox.y;
      });
      return json
    } catch (error) {
      console.error('Error loading blocks:', error)
      throw new Error('Failed to load blocks')
    }
  }

  async addText(pageNumber = 0, text: string, x = 90, y = 10, size = 18) {
    const page = this.document.loadPage(pageNumber)
    const page_height = page.getBounds()[3]
    const page_obj = page.getObject()
    const font = this.document.addSimpleFont(new this.mupdf.Font("Times-Roman"))

    const res = page_obj.get("Resources")
    const res_font = res.get("Font")
    res_font.put("F1", font)

    const extra_contents = this.document.addStream(`BT /F1 ${size} Tf 1 0 0 1 ${x} ${page_height - y} Tm (${text}) Tj ET`, {})

    const page_contents = page_obj.get("Contents")
    if (page_contents.isArray()) {
      page_contents.push(extra_contents)
    } else {
      const new_page_contents = this.document.newArray()
      new_page_contents.push(page_contents)
      new_page_contents.push(extra_contents)
      page_obj.put("Contents", new_page_contents)
    }
  }

  async deleteText(pageNumber = 0, cord = [40, 10, 300, 80]) {
    const page = this.document.loadPage(pageNumber);
    const annotation = page.createAnnotation("Redact");
    annotation.setRect(cord);
    annotation.applyRedaction(false, 0);
  }

  async updateText(pageNumber = 0, block: any, text: string): Promise<void> {
    if (!this.mupdf) throw new Error('MuPDF not initialized')
    try {
      const blockCords = block.bbox
      await this.deleteText(pageNumber, [blockCords.x, blockCords.y, blockCords.x + blockCords.w, blockCords.y + blockCords.h])
      await this.addText(pageNumber, text, blockCords.x, blockCords.y + 5, block.lines[0].font.size)
    } catch (error) {
      console.error('Error updating text:', error)
      throw new Error('Failed to update text')
    }
  }

  async merge(file: ArrayBuffer, pageNumber = 0): Promise<void> {
    if (!this.mupdf) throw new Error('MuPDF not initialized')
    try {
      const otherdocument = this.mupdf.Document.openDocument(file, "application/pdf");
      this.document.graftPage(0, otherdocument, pageNumber)
    } catch (error) {
      console.error('Error return document:', error)
      throw new Error('Failed to return document')
    }
  }

  async AddAnnotations(pageNumber = 0, text: string): Promise<void> {
    if (!this.mupdf) throw new Error('MuPDF not initialized')
    try {
      const page = this.document.loadPage(pageNumber)
      const note = page.createAnnotation("Text")
      note.setContents(text)
      note.setRect([100, 100, 0, 0])
      note.update()
    } catch (error) {
      console.error('Error loading annotations:', error)
      throw new Error('Failed to load annotations')
    }
  }

  async AddHighlight(pageNumber = 0, block: any): Promise<void> {
    if (!this.mupdf) throw new Error('MuPDF not initialized')
    try {
      const page = this.document.loadPage(pageNumber)
      const blockCords = block.bbox
      const annotation = page.createAnnotation("Highlight")

      annotation.setColor([1, 1, 0])
      annotation.setQuadPoints([[
        blockCords.x, blockCords.y,
        blockCords.x + blockCords.w, blockCords.y,
        blockCords.x, blockCords.y + blockCords.h,
        blockCords.x + blockCords.w, blockCords.y + blockCords.h,]
      ])

      annotation.update()
    } catch (error) {
      console.error('Error loading annotations:', error)
      throw new Error('Failed to load annotations')
    }
  }

  async getDocument(): Promise<any> {
    if (!this.mupdf) throw new Error('MuPDF not initialized')
    try {
      const doc = this.document.saveToBuffer("incremental").asUint8Array()
      return doc
    } catch (error) {
      console.error('Error return document:', error)
      throw new Error('Failed to return document')
    }
  }

}

Comlink.expose(new MupdfWorker())
