import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { Navbar } from "../../components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../../components/ui/card";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Id } from "../../convex/_generated/dataModel";

export default function EditorPage() {
  const navigate = useNavigate();
  const user = useQuery(api.auth.getMe);
  const permission = useQuery(api.auth.getUserPermission);
  const notes = useQuery(api.privateNotes.getNotes);
  
  const createNote = useMutation(api.privateNotes.createNote);
  const deleteNote = useMutation(api.privateNotes.deleteNote);
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [accessLevel, setAccessLevel] = useState("viewer");
  
  useEffect(() => {
    if (permission === null && user) {
      navigate({ to: "/" });
    }
  }, [permission, user, navigate]);

  try {
    if (!user || !permission) {
      return (
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-grow w-full max-w-5xl mx-auto px-4">
            <h1 className="text-3xl font-bold mb-8">Editor Dashboard</h1>
            <Card><CardContent className="py-8 flex items-center justify-center"><p>Loading...</p></CardContent></Card>
          </main>
        </div>
      );
    }

    if (!["editor", "admin", "owner"].includes(permission)) {
      navigate({ to: "/" });
      return (
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-grow w-full max-w-5xl mx-auto px-4">
            <h1 className="text-3xl font-bold mb-8">Editor Dashboard</h1>
            <Card><CardContent className="py-8 flex items-center justify-center"><p>You need editor permissions to view this page.</p></CardContent></Card>
          </main>
        </div>
      );
    }
    
    const handleCreateNote = () => {
      if (title && content) {
        createNote({ title, content, accessLevel }).then(() => { setTitle(""); setContent(""); });
      }
    };
    
    const handleDeleteNote = (noteId: Id<"privateNotes">) => { deleteNote({ noteId }); };

    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-8">Editor Dashboard</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Note</CardTitle>
                <CardDescription>Add a new private note</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-medium">Title</label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="content" className="text-sm font-medium">Content</label>
                    <textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Note content" className="w-full min-h-20 p-2 border rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="access" className="text-sm font-medium">Minimum access level</label>
                    <select id="access" value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)} className="w-full p-2 border rounded-md">
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleCreateNote} disabled={!title || !content}>Create Note</Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Your Notes</CardTitle>
                <CardDescription>Your current permission level: {permission}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {notes && notes.length > 0 ? (
                    notes.map(note => (
                      <div key={note._id} className="p-4 border rounded-md">
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium">{note.title}</h3>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteNote(note._id)}>Delete</Button>
                        </div>
                        <p className="mt-2 text-sm">{note.content}</p>
                        <p className="mt-2 text-xs text-muted-foreground">Access level: {note.accessLevel}</p>
                      </div>
                    ))
                  ) : (
                    <p>No notes found. Create one to get started.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  } catch (error) {
    console.error("Error in EditorPage:", error);
    return <div>Something went wrong. Please try again later.</div>;
  }
}
