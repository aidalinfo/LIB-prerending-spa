const puppeteer = require('puppeteer');
const httpServer = require('http-server');
const fse = require('fs-extra');
const path = require('path');
const portfinder = require('portfinder');

class SPAPrerenderer {
  constructor({ inputDir, outputDir, routes }) {
    this.inputDir = inputDir;
    this.outputDir = outputDir;
    this.routes = routes;
  }

  async prerender() {
    const server = httpServer.createServer({ root: this.inputDir });

    // Configue portfinder
    portfinder.basePort = 8000;

    // Find port for starting the server
    const port = await portfinder.getPortPromise();

    server.listen(port, 'localhost', async () => {
      console.log(`HTTP Server running on http://localhost:${port}`);

      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      for (const route of this.routes) {
        await page.goto(`http://localhost:${port}${route}`, { waitUntil: 'networkidle0' });
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        const content = await page.content(); // Capture the HTML content of the page

        const outputPath = path.join(this.outputDir, route, 'index.html');
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

      server.close(); // Close the HTTP server at the end
      console.log('HTTP Server closed.');
    });
  }
}


module.exports = SPAPrerenderer;