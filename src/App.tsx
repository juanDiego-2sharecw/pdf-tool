/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { FormEvent, useEffect, useState } from "react";
import { useMupdf } from "./hooks/useMupdf";

const App: React.FC = () => {
  // states
  const [file, setFile] = useState<ArrayBuffer | null>();
  const [doc, setDoc] = useState('');
  const [page, setPage] = useState<{ number: number, image: string }>({
    number: 0,
    image: ''
  });
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // hooks
  const { workerInitialized, loadDocument, renderPage, loadBookmarks, addBookmark, getDocument, getBlocks, updateText, merge, AddAnnotations, AddHighlight } = useMupdf();
  useEffect(() => {
    initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerInitialized, file]);

  // functions
  const initialize = async () => {
    if (!workerInitialized) return
    loadFile()
  }

  const loadFile = async () => {
    setLoading(true)
    if (file) await loadDocument(file)
    else {
      const response = await fetch("/test.pdf");
      const arrayBuffer = await response.arrayBuffer();
      await loadDocument(arrayBuffer)
    }
    await loadFileBookmarks()
    await loadFilePage(0)
    await loadFileBlocks(0)
    await loadFileDocument()
  }

  const loadFilePage = async (pageNumber = 0) => {
    const pngData = await renderPage(pageNumber);
    const url = URL.createObjectURL(new Blob([pngData], { type: "image/png" }));
    setPage({ number: pageNumber, image: url })
    setLoading(false)
  }

  const loadFileDocument = async () => {
    const data = await getDocument();
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    setDoc(url)
    setLoading(false)
  }

  const loadFileBookmarks = async () => {
    const bookmarks = await loadBookmarks()
    setBookmarks(bookmarks)
  }

  const loadFileBlocks = async (pageNumber = 0) => {
    const blocks = await getBlocks(pageNumber)
    setBlocks(blocks)
  }

  const handleAddBookmark = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const parent = e.currentTarget.parent.value !== 'None' ? e.currentTarget.parent.value : null
    const bookmarks = await addBookmark(e.currentTarget.page.value - 1, e.currentTarget.title.value, parent)
    setBookmarks(bookmarks)
  }

  const handleAddAnnotation = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await AddAnnotations(e.currentTarget.page.value - 1, e.currentTarget.title.value)
    await loadFileDocument()
  }

  const handleMerge = async (e: any) => {
    e.preventDefault()
    const files = e.currentTarget.pdf.files;
    const page = e.currentTarget.page.value - 1

    if (!files || files.length === 0) {
      console.error("not file selected");
      return;
    }

    const reader = new FileReader();
    reader.readAsArrayBuffer(files[0]);
    reader.onload = async () => {
      const buffer = reader.result;
      await merge(buffer as ArrayBuffer, page)
      await loadFilePage(0)
      await loadFileDocument()
    };
  }

  const handleSelectFile = (e: any) => {
    const files = e.target.files;

    if (!files || files.length === 0) {
      console.error("not file selected");
      return;
    }

    const reader = new FileReader();
    reader.readAsArrayBuffer(files[0]);
    reader.onload = () => {
      const buffer = reader.result;
      setFile(buffer as ArrayBuffer);
    };
  }

  const downloadFile = async () => {
    const fileBuffer = await getDocument()
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = new Date().getMilliseconds() + 'archivo.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleChangePage = async (pageNumber = 0) => {
    await loadFilePage(pageNumber)
    await loadFileDocument()
    await loadFileBlocks(pageNumber)
  }

  const handleUpdateText = async (block: object, text: string) => {
    await updateText(page.number, block, text)
    await loadFileBlocks(page.number)
    await loadFilePage(page.number)
    await loadFileDocument()
  }

  const handleHighlight = async (block: object) => {
    await AddHighlight(page.number, block)
    await loadFileDocument()
  }

  if (loading)
    return (
      <div className="loading">
        <img width={200} src="https://th.bing.com/th/id/R.4605b9d7fb097db18af9f830a5e239cc?rik=HFjSvqrump3SaA&pid=ImgRaw&r=0" alt="loading" />
      </div>
    )

  return (
    <div className="container">
      <div className="header">
        <button title="anterior" onClick={() => handleChangePage(page.number - 1)}>{'<'}</button>
        <h2>Page #{page.number + 1}</h2>
        <button title="siguiente" onClick={() => handleChangePage(page.number + 1)}>{'>'}</button>
      </div>
      <div className="controls">
        <div className="selectFile">
          <h2>Open File</h2>
          <input type="file" name="pdf" onChange={(e) => handleSelectFile(e)} />
        </div>
        <div className="bookmarks">
          <h2>Bookmarks</h2>
          {
            bookmarks.length > 0 ?
              <ul>
                {
                  bookmarks.map(bookmark => (
                    <li key={bookmark.uri}>
                      <h4 title={"go to page " + (bookmark.page + 1)} onClick={() => loadFilePage(bookmark.page)}>{bookmark.title}</h4>
                      {
                        bookmark.down?.length > 0 &&
                        <ul>
                          {
                            bookmark.down.map((subBookmark: { uri: string, title: string, page: number }) => (
                              <li key={subBookmark.uri}><h5 title={"go to page " + (subBookmark.page + 1)} onClick={() => loadFilePage(subBookmark.page)}>{subBookmark.title}</h5></li>
                            ))
                          }
                        </ul>
                      }
                    </li>
                  ))
                }
              </ul>
              : <p>the file not contains bookmarks</p>
          }
        </div>
        <div className="addBookmark">
          <h2>Add Bookmark</h2>
          <form onSubmit={(e) => handleAddBookmark(e)}>
            <label htmlFor="parent">Parent Bookmark:</label>
            <select id="parent" name="parent" disabled={!(bookmarks.length > 0)}>
              <option value="None">None</option>
              {
                bookmarks.length > 0 &&
                bookmarks.map(bookmark => (
                  <option key={bookmark.uri} value={bookmark.title}>{bookmark.title}</option>
                ))
              }
            </select>
            <input type="text" name="title" placeholder="Title" required />
            <input type="number" name="page" placeholder="Page number" required />
            <button>add bookmark</button>
          </form>
        </div>
        <div className="addAnnotation">
          <h2>Add Annotation</h2>
          <form onSubmit={(e) => handleAddAnnotation(e)}>
            <input type="text" name="title" placeholder="Title" required />
            <input type="number" name="page" placeholder="Page number" required />
            <button>add annotation</button>
          </form>
        </div>
        <div className="merge">
          <h2>Merge</h2>
          <form onSubmit={(e) => handleMerge(e)}>
            <input type="file" name="pdf" required />
            <input type="number" name="page" placeholder="Page number" required />
            <button>Merge page</button>
          </form>
        </div>
        <div className="downloadFile">
          <h2>Download File</h2>
          <button onClick={() => downloadFile()}>save file</button>
        </div>
      </div>
      <div className="viewer">
        {doc && <object id="pdf-viewer" width="100%" height="100%" type="application/pdf" data={doc}></object>}
        {/* {page.image && <img src={page.image} alt="PDF page" />} */}
      </div>
      <div className="blocks">
        <h2>File Texts</h2>
        {
          blocks.length > 0 &&
          blocks.map(block => {
            block.text = ''
            block.lines.map((line: { text: string }) => block.text += " " + line.text)
            return <div key={block.bbox.x + block.bbox.y} >
              <textarea defaultValue={block.text}
                onChange={(e) => setTimeout(() => {
                  handleUpdateText(block, e.target.value)
                }, 2000)} />
              <button onClick={() => handleHighlight(block)}>highlight text</button>
            </div>
          })
        }
      </div>
    </div>
  );
};

export default App;
