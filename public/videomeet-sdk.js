/**
 * VideoMeet Free WebRTC Integration SDK
 * Biblioteca para incorporar Transmissão P2P e Videochamadas em qualquer site/app.
 * 100% Gratuito, seguro, baixa latência e com personalização completa de controles.
 */
(function (global) {
  'use strict';

  var VideoMeet = {
    version: '1.1.0',

    /**
     * Gera um código de sala/pareamento no padrão (ex: abc-defg-hij)
     */
    generateCode: function () {
      var chars = 'abcdefghijklmnopqrstuvwxyz';
      var seg = function (len) {
        var str = '';
        for (var i = 0; i < len; i++) {
          str += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return str;
      };
      return seg(3) + '-' + seg(4) + '-' + seg(3);
    },

    /**
     * Resolve o container (seletor string ou HTMLElement)
     */
    _getContainer: function (target) {
      if (typeof target === 'string') {
        return document.querySelector(target);
      }
      return target || document.body;
    },

    /**
     * Obtém a URL base do serviço VideoMeet
     */
    _getBaseUrl: function (customUrl) {
      if (customUrl) return customUrl.replace(/\/$/, '');
      if (typeof window !== 'undefined' && window.location) {
        return window.location.origin;
      }
      return '';
    },

    /**
     * Cria um iframe configurado com permissões WebRTC
     */
    _createIframe: function (src, options) {
      var iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.setAttribute('allow', 'camera; microphone; display-capture; autoplay; clipboard-write; fullscreen');
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.style.width = options.width || '100%';
      iframe.style.height = options.height || '100%';
      iframe.style.border = 'none';
      iframe.style.borderRadius = options.borderRadius || '12px';
      iframe.style.backgroundColor = '#0b0c10';
      return iframe;
    },

    /**
     * Helper para formatar parâmetros de controles e modo limpo
     */
    _appendControlsParams: function (url, options) {
      if (!options) return url;
      if (options.clean === true || options.controls === 'none' || options.controls === false) {
        return url + '&controls=none';
      }
      if (options.header === false) {
        url += '&header=false';
      }
      if (options.toolbar === false) {
        url += '&toolbar=false';
      }
      if (options.buttons) {
        var btns = Array.isArray(options.buttons) ? options.buttons.join(',') : options.buttons;
        url += '&buttons=' + encodeURIComponent(btns);
      } else if (options.controls && options.controls !== 'all' && options.controls !== true) {
        var ctrls = Array.isArray(options.controls) ? options.controls.join(',') : options.controls;
        url += '&controls=' + encodeURIComponent(ctrls);
      }
      return url;
    },

    /**
     * MODO 1: Receptor de Transmissão (Viewer / Monitor)
     * Recebe a câmera/tela de outro dispositivo via código em tempo real.
     *
     * @example
     * // Modo Limpo (apenas o vídeo da transmissão sem nenhum botão)
     * VideoMeet.createViewer({ roomCode: 'abc-defg-hij', controls: 'none' });
     *
     * @example
     * // Selecionando botões específicos
     * VideoMeet.createViewer({ roomCode: 'abc-defg-hij', buttons: ['audio', 'fullscreen'] });
     */
    createViewer: function (options) {
      options = options || {};
      var code = options.roomCode || this.generateCode();
      var baseUrl = this._getBaseUrl(options.baseUrl);
      var container = this._getContainer(options.container);

      var url = baseUrl + '/?mode=stream&role=viewer&room=' + encodeURIComponent(code) + '&embed=true';
      if (options.muted) url += '&muted=1';
      url = this._appendControlsParams(url, options);

      var iframe = this._createIframe(url, options);
      if (container) {
        container.innerHTML = '';
        container.appendChild(iframe);
      }

      return {
        iframe: iframe,
        roomCode: code,
        url: url,
        destroy: function () {
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        },
      };
    },

    /**
     * MODO 2: Transmissor de Câmera/Tela (Sender)
     * Transmite a câmera ou tela deste dispositivo para o código informado.
     *
     * @example
     * // Modo Limpo (apenas a câmera transmitindo, sem cabeçalho nem botões)
     * VideoMeet.createSender({ roomCode: 'abc-defg-hij', controls: 'none' });
     *
     * @example
     * // Escolhendo quais botões exibir:
     * VideoMeet.createSender({
     *   roomCode: 'abc-defg-hij',
     *   buttons: ['audio', 'video', 'quality', 'fullscreen'],
     *   header: false
     * });
     */
    createSender: function (options) {
      options = options || {};
      var code = options.roomCode || this.generateCode();
      var baseUrl = this._getBaseUrl(options.baseUrl);
      var container = this._getContainer(options.container);

      var url = baseUrl + '/?mode=stream&role=sender&room=' + encodeURIComponent(code) + '&embed=true';
      if (options.camera) url += '&camera=' + encodeURIComponent(options.camera);
      if (options.quality) url += '&quality=' + encodeURIComponent(options.quality);
      url = this._appendControlsParams(url, options);

      var iframe = this._createIframe(url, options);
      if (container) {
        container.innerHTML = '';
        container.appendChild(iframe);
      }

      return {
        iframe: iframe,
        roomCode: code,
        url: url,
        destroy: function () {
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        },
      };
    },

    /**
     * Gera links e URLs completas de sessão para transmissor, receptor e reunião.
     */
    createSession: function (customCode, customBaseUrl, options) {
      var code = customCode || this.generateCode();
      var base = this._getBaseUrl(customBaseUrl);
      var senderEmbed = base + '/?mode=stream&role=sender&room=' + encodeURIComponent(code) + '&embed=true';
      var viewerEmbed = base + '/?mode=stream&role=viewer&room=' + encodeURIComponent(code) + '&embed=true';
      
      if (options) {
        senderEmbed = this._appendControlsParams(senderEmbed, options);
        viewerEmbed = this._appendControlsParams(viewerEmbed, options);
      }

      return {
        roomCode: code,
        senderUrl: base + '/?mode=stream&role=sender&room=' + encodeURIComponent(code),
        viewerUrl: base + '/?mode=stream&role=viewer&room=' + encodeURIComponent(code),
        meetingUrl: base + '/?room=' + encodeURIComponent(code),
        senderEmbedUrl: senderEmbed,
        viewerEmbedUrl: viewerEmbed,
        meetingEmbedUrl: base + '/?room=' + encodeURIComponent(code) + '&embed=true',
      };
    },

    /**
     * MODO 3: Chamada de Vídeo Completa (Full Meeting Embed)
     * Reunião bidirecional completa com controles, áudio, vídeo e chat.
     */
    createCall: function (options) {
      options = options || {};
      var code = options.roomCode || this.generateCode();
      var baseUrl = this._getBaseUrl(options.baseUrl);
      var container = this._getContainer(options.container);

      var url = baseUrl + '/?room=' + encodeURIComponent(code) + '&embed=true';
      if (options.userName) url += '&name=' + encodeURIComponent(options.userName);
      if (options.audio === false) url += '&audio=0';
      if (options.video === false) url += '&video=0';

      var iframe = this._createIframe(url, options);
      if (container) {
        container.innerHTML = '';
        container.appendChild(iframe);
      }

      return {
        iframe: iframe,
        roomCode: code,
        url: url,
        destroy: function () {
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        },
      };
    },
  };

  // Exportação Global
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoMeet;
  } else {
    global.VideoMeet = VideoMeet;
  }
})(typeof window !== 'undefined' ? window : this);
