const puppeteer = require('puppeteer');
const express = require('express');
const fse = require('fs-extra');
const path = require('path');
const portfinder = require('portfinder');
require("dotenv").config();

class SPAPrerenderer {
  constructor({ inputDir, outputDir, routes }) {
    this.inputDir = inputDir;
    this.outputDir = outputDir;
    this.routes = routes;
  }

  async prerender() {
    const app = express();
    const staticPath = path.join(this.inputDir);

    // Servir les fichiers statiques
    app.use(express.static(staticPath));

    // Toutes les requêtes après / sont redirigés vers index.html
    app.get('*', (req, res) => {
      const indexPath = path.join(staticPath, 'index.html');
      res.sendFile(indexPath); // Utilise le chemin absolu
    });

    // Configuer portfinder pour trouver un port libre
    portfinder.basePort = 8000;
    const port = await portfinder.getPortPromise();

    app.listen(port, 'localhost', async () => {
      console.log(`Express Server running on http://localhost:${port}`);

      const browser = await puppeteer.launch({
        headless: true,
        args: [
          "--disable-setuid-sandbox",
          "--no-sandbox",
          "--single-process",
          "--no-zygote",
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      });
      // console.log("Executable path: " + browser.executablePath);
      const page = await browser.newPage();

      for (const route of this.routes) {
        await page.goto(`http://localhost:${port}${route}`, { waitUntil: 'networkidle0' });
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        const content = await page.content(); // Capture the HTML content of the page
        
        const fileName = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
        const outputPath = path.join(this.outputDir, fileName);
        await fse.ensureDir(path.dirname(outputPath)); // Ensure directory exists
        await fse.writeFile(outputPath, content); // Write the HTML content to file
      }

      await browser.close(); // Close the browser
      console.log('Prerendering completed.');

      // Copy the assets folder from inputDir to outputDir
      const sourceAssetsPath = path.join(this.inputDir, 'assets');
      const destAssetsPath = path.join(this.outputDir, 'assets');
      await fse.copy(sourceAssetsPath, destAssetsPath);
      console.log('Assets copied.');

      process.exit(0); // exit the HTTP server at the end
    });
  }
}


module.exports = SPAPrerenderer;
