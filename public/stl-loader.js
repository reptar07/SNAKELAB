import {
  BufferAttribute,
  BufferGeometry,
  FileLoader,
  Float32BufferAttribute,
  Loader,
  Vector3
} from 'three';

/**
 * STLLoader: Loads STL models (ASCII and binary formats)
 * Original: Three.js examples/jsm/loaders/STLLoader.js
 * This is the ES module version imported from Three.js CDN
 */

class STLLoader extends Loader {
  constructor(manager) {
    super(manager);
  }

  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const loader = new FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(url, function (text) {
      try {
        onLoad(scope.parse(text));
      } catch (e) {
        onError(e);
      }
    }, onProgress, onError);
  }

  parse(data) {
    const view = new DataView(data);
    const isBinary = () => {
      const header = new Uint8Array(data, 0, 5);
      const headerStr = new TextDecoder().decode(header);
      return headerStr === 'solid' ? false : true;
    };

    if (isBinary()) {
      return this.parseBinary(data);
    } else {
      return this.parseASCII(data);
    }
  }

  parseBinary(data) {
    const view = new DataView(data);
    const isLittleEndian = true;
    const headerLength = 80;
    const triangles = view.getUint32(headerLength, isLittleEndian);

    const geometry = new BufferGeometry();
    const vertices = [];
    const normals = [];

    let offset = headerLength + 4;
    let faces = 0;

    for (let i = 0; i < triangles; i++) {
      const nx = view.getFloat32(offset, isLittleEndian);
      offset += 4;
      const ny = view.getFloat32(offset, isLittleEndian);
      offset += 4;
      const nz = view.getFloat32(offset, isLittleEndian);
      offset += 4;

      for (let j = 0; j < 3; j++) {
        vertices.push(view.getFloat32(offset, isLittleEndian));
        offset += 4;
        vertices.push(view.getFloat32(offset, isLittleEndian));
        offset += 4;
        vertices.push(view.getFloat32(offset, isLittleEndian));
        offset += 4;

        normals.push(nx, ny, nz);
      }

      offset += 2;
      faces++;
    }

    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(vertices), 3)
    );
    geometry.setAttribute(
      'normal',
      new BufferAttribute(new Float32Array(normals), 3)
    );

    return geometry;
  }

  parseASCII(data) {
    const geometry = new BufferGeometry();
    const vertices = [];
    const normals = [];

    const patternNormal = /normal\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)/g;
    const patternVertex = /vertex\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)/g;
    const patternEndsolid = /endsolid/g;

    const text = new TextDecoder().decode(data);

    let normalData = [0, 0, 1];

    let normalMatch;
    while ((normalMatch = patternNormal.exec(text))) {
      normalData = [
        parseFloat(normalMatch[1]),
        parseFloat(normalMatch[3]),
        parseFloat(normalMatch[5])
      ];
    }

    patternNormal.lastIndex = 0;

    let vertexMatch;
    let vertexPatternLocal = /vertex\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)/g;

    while ((vertexMatch = vertexPatternLocal.exec(text))) {
      vertices.push(
        parseFloat(vertexMatch[1]),
        parseFloat(vertexMatch[3]),
        parseFloat(vertexMatch[5])
      );

      normals.push(normalData[0], normalData[1], normalData[2]);
    }

    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(vertices), 3)
    );
    geometry.setAttribute(
      'normal',
      new BufferAttribute(new Float32Array(normals), 3)
    );

    return geometry;
  }
}

export { STLLoader };
