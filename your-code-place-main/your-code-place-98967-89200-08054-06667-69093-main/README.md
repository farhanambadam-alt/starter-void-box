# RepoPush 🚀

<div align="center">

**A modern, intuitive GitHub repository manager built with React and Supabase**

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Architecture](#architecture) • [Contributing](#contributing)

</div>

---

## 📖 About

RepoPush is a web-based GitHub repository management tool that simplifies the way developers interact with their GitHub repositories. With an intuitive VS Code-style file browser and powerful repository management features, RepoPush makes it easy to create, edit, and organize your projects directly from your browser.

Perfect for:
- 🎓 Beginners learning Git and GitHub
- 💼 Developers managing multiple repositories
- 📱 Quick edits on-the-go
- 🚀 Rapid prototyping and project setup

---

## ✨ Features

### Repository Management
- 📦 **Create & Manage Repositories** - Full CRUD operations for GitHub repos
- 🌿 **Branch Management** - Switch between branches, create new ones
- ⭐ **Star/Unstar** - Organize your favorite repositories
- 🔄 **Sync Repository** - Keep your local view in sync with GitHub
- ⚙️ **Repository Settings** - Update description, visibility, and more

### File Operations
- 📁 **VS Code-Style File Browser** - Familiar, intuitive file navigation
- ✏️ **File Editor** - Edit files directly in the browser
- 📤 **File Upload** - Drag-and-drop or select multiple files
- 🗂️ **Folder Operations** - Create, delete, and manage directories
- 👁️ **File Viewer** - Preview text files with syntax highlighting

### Pull Requests
- 🔀 **Create Pull Requests** - Submit PRs directly from the interface
- 📝 **PR Management** - View and track your pull requests

### Modern UI/UX
- 🌙 **Dark Theme** - Easy on the eyes
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- ⚡ **Fast & Smooth** - Optimized performance with loading states
- 🔔 **Toast Notifications** - Clear feedback for all actions

---

## 🚀 Installation

### Prerequisites
- Node.js 18+ or Bun
- A GitHub account
- A Supabase account (for backend services)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/repopush.git
   cd repopush
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   # or
   bun dev
   ```

5. **Open your browser**
   
   Navigate to `http://localhost:5173`

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the migrations in the `supabase/migrations` folder
3. Deploy the edge functions:
   ```bash
   supabase functions deploy
   ```
4. Configure GitHub OAuth in Supabase:
   - Go to Authentication → Providers
   - Enable GitHub provider
   - Add your GitHub OAuth credentials

---

## 📚 Usage

### Getting Started

1. **Sign In with GitHub**
   - Click "Get Started" on the home page
   - Authenticate with your GitHub account

2. **View Your Repositories**
   - Navigate to the Dashboard to see all your repos
   - Use the search bar to find specific repositories

3. **Create a New Repository**
   - Click the "+" button or "New Repository"
   - Follow the wizard to set up your repo
   - Push files directly from the interface

4. **Edit Files**
   - Browse to any repository
   - Click on a file to view it
   - Click "Edit" to make changes
   - Save your changes with a commit message

5. **Create Pull Requests**
   - Make changes in a branch
   - Navigate to Pull Requests
   - Fill in the PR details and submit

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | New file |
| `Ctrl/Cmd + S` | Save file |
| `Ctrl/Cmd + K` | Open command palette |
| `?` | Show shortcuts |

---

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- ⚛️ React 18 + TypeScript
- 🎨 Tailwind CSS + shadcn/ui
- 🔄 React Router for navigation
- 🔍 React Query for data fetching
- 📝 React Hook Form + Zod for forms

**Backend:**
- 🔥 Supabase (PostgreSQL + Auth + Storage)
- ⚡ Edge Functions (Deno) for GitHub API integration
- 🔐 Row Level Security (RLS) policies

**Build & Dev:**
- ⚡ Vite for blazing-fast builds
- 📦 Bun for dependency management

### Project Structure

```
repopush/
├── src/
│   ├── components/        # React components
│   │   ├── repository/   # Repo-specific components
│   │   ├── ui/           # shadcn/ui components
│   │   └── wizard/       # Setup wizard components
│   ├── hooks/            # Custom React hooks
│   ├── integrations/     # Supabase client & types
│   ├── lib/              # Utilities & helpers
│   ├── pages/            # Route pages
│   └── main.tsx          # App entry point
├── supabase/
│   ├── functions/        # Edge Functions
│   ├── migrations/       # Database migrations
│   └── config.toml       # Supabase config
└── public/               # Static assets
```

### Edge Functions

RepoPush uses 15+ Supabase Edge Functions to interact with the GitHub API:

- `list-repos` - Fetch user repositories
- `create-and-push-repo` - Create new repositories
- `get-repo-contents` - Browse repository files
- `create-file` / `update-file` / `delete-file` - File operations
- `upload-files` - Batch file uploads
- `get-repo-branches` - Branch management
- `create-pull-request` - PR creation
- `star-repo` - Star/unstar repositories
- And more...

### Data Flow

```
User Action → React Component → Supabase Edge Function → GitHub API
                    ↓                      ↓
                React Query Cache    Supabase Auth/DB
```

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/yourusername/repopush/issues)
2. If not, create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

### Suggesting Features

1. Open a new issue with the `enhancement` label
2. Describe the feature and its benefits
3. Provide examples or mockups if possible

### Pull Requests

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test thoroughly
5. Commit with clear messages: `git commit -m "Add feature: description"`
6. Push to your fork: `git push origin feature/your-feature-name`
7. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Write meaningful commit messages
- Add comments for complex logic
- Test your changes before submitting
- Update documentation if needed

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [Supabase](https://supabase.com/) - Backend infrastructure
- [GitHub API](https://docs.github.com/en/rest) - Repository management
- [Lucide Icons](https://lucide.dev/) - Icon library

---

## 📞 Support

- 📧 Email: support@repopush.com
- 💬 Discord: [Join our community](https://discord.gg/repopush)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/repopush/issues)
- 📖 Docs: [Documentation](https://docs.repopush.com)

---

<div align="center">

**Built with ❤️ by the RepoPush team**

[⭐ Star us on GitHub](https://github.com/yourusername/repopush) • [🐦 Follow on Twitter](https://twitter.com/repopush)

</div>
