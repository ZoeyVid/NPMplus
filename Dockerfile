# syntax=docker/dockerfile:1.26.0@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32
FROM alpine:3.24.1@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b AS nginx
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]

ARG LUAJIT_INC=/usr/include/luajit-2.1
ARG LUAJIT_LIB=/usr/lib

ARG AWSLC_VER=991e67ff4cf04df4dd89e407f8b920c6936cb56a # v5.5.0

ARG NGINX_VER=a885808aa592eea32c8064624717be3d94fbdfe7 # release-1.31.3
ARG DTR_VER=1.29.2
ARG RCP_VER=1.31.3
ARG ZNP_VER=1.30.0

ARG NB_VER=0c6727ab0331c8cd6dffe2d54710d7c7675def6f # master
ARG NUB_VER=3ca76aa106e19a01f0634e0e81299d0b4b8e7fa1 # main
ARG ZNM_VER=53927b6408ebf166496a3d79f016563f7f720cb0 # v0.4.0
ARG NHUZFM_VER=658990e20a5f1cefbf760eb427741ce95b6eebc9 # main
ARG NF_VER=047589e4dc0041517b8a47739fa960c430c4045e # v0.6.0
ARG HMNM_VER=0bf283ff92017acd616814b0e5153e0ccf93e2c9 # v0.40
ARG NDK_VER=bd44d16302273052d6005d7bdb55f74e23813de3 # v0.3.4
ARG LNM_VER=84cc201565bc2ef12dcab6eb25e7ccaf44d56d42 # v0.10.32rc4

ARG NJS_VER=ad60b62c3b4ca6339ca19c19ceed8c942dbe575d # 1.0.0
ARG NAL_VER=241200eac8e4acae74d353291bd27f79e5ca3dc4 # master
ARG VTS_VER=38b8612527ecb003ea15cefe934f302cf1a7c27e # v0.2.7
ARG NNTLM_VER=3da77b0cb30e517dfee01d7e7f7d649144d24051 # master
ARG NHG2M_VER=cbaa35461c62a99d2577e6bae3273492502d8769 # 3.4


WORKDIR /src
COPY patches/*.patch /src
COPY rootfs/usr/local/bin/git-clone-commit.sh /usr/local/bin/git-clone-commit.sh

RUN apk upgrade --no-cache -a && \
    apk add --no-cache git clang lld compiler-rt llvm-libunwind-dev libc++-dev linux-headers cmake ninja make pkgconf llvm file \
                       libatomic_ops-dev pcre2-dev luajit-dev zlib-ng-dev brotli-dev zstd-dev libxslt-dev openldap-dev quickjs-ng-dev libmaxminddb-dev clang-dev

RUN for f in $(apk info --no-cache -qL libgcc-static libstdc++-dev); do rm -v /"$f"; done && \
    echo "-fuse-ld=lld --rtlib=compiler-rt --unwindlib=libunwind -stdlib=libc++ -D_LIBCPP_HARDENING_MODE=_LIBCPP_HARDENING_MODE_EXTENSIVE" | tee /etc/clang*/*.cfg

ARG CC=clang
ARG CXX=clang++
ARG LD=ld.lld
ARG AR=llvm-ar

ARG FLAGS
ARG CFLAGS="$FLAGS -m64 -O3 -pipe -flto=full -ffunction-sections -fdata-sections -fno-math-errno -ffp-contract=fast -fstack-clash-protection -fstack-protector-strong -fzero-call-used-regs=used-gpr -fstrict-flex-arrays=3 -ftrivial-auto-var-init=zero -fno-delete-null-pointer-checks -fno-strict-overflow -fno-strict-aliasing -fno-semantic-interposition -fno-plt -U_FORTIFY_SOURCE -D_FORTIFY_SOURCE=3 -Wformat=2 -Werror=format-security"
ARG CXXFLAGS="$CFLAGS"
ARG LDFLAGS="-m64 -Wl,-s -Wl,-O2 -Wl,--lto-O3 -Wl,--icf=safe -Wl,--gc-sections -Wl,-z,noexecstack -Wl,-z,relro -Wl,-z,now -Wl,--sort-common -Wl,--as-needed -Wl,-z,pack-relative-relocs -Wl,--no-copy-dt-needed-entries"

RUN git config --global advice.detachedHead false && \
    git config --global init.defaultBranch main

RUN git-clone-commit.sh https://github.com/aws/aws-lc "$AWSLC_VER" /src/aws-lc && \
    cd /src/aws-lc && \
    git apply /src/aws-lc-tls13-cipher-preference.patch && \
    cmake /src/aws-lc -G Ninja -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=ON -DDISABLE_GO=ON -DDISABLE_PERL=ON -DBUILD_TESTING=OFF && \
    ninja install

RUN git-clone-commit.sh https://github.com/nginx/nginx "$NGINX_VER" /src/nginx && \
    cd /src/nginx && \
    wget -q https://patch-diff.githubusercontent.com/raw/nginx/nginx/pull/689.patch -O /src/nginx/1.patch && \
    echo "73fdee62748f1624f87015a951a2480fd0d4fe566a81d92b852b51536d954b91  /src/nginx/1.patch" | sha256sum -c - && \
    git apply /src/nginx/1.patch && \
    wget -q https://patch-diff.githubusercontent.com/raw/nginx/nginx/pull/1219.patch -O /src/nginx/2.patch && \
    echo "156432a472e12688863783b0a7d41e22065e3308f18aab27667e7c558a893150  /src/nginx/2.patch" | sha256sum -c - && \
    git apply /src/nginx/2.patch && \
    wget -q https://patch-diff.githubusercontent.com/raw/nginx/nginx/pull/1333.patch -O /src/nginx/3.patch && \
    echo "01bf75b130b8f91075ec913a400a8debfab6da0ac609711c7d412ddbe59dd898  /src/nginx/3.patch" | sha256sum -c - && \
    git apply /src/nginx/3.patch && \
    wget -q https://raw.githubusercontent.com/nginx-modules/ngx_http_tls_dyn_size/master/nginx__dynamic_tls_records_"$DTR_VER"%2B.patch -O /src/nginx/4.patch && \
    echo "0aa9c73e7515dbbd48ecc798f7894412c1a50e96e98aee25847e823059faf821  /src/nginx/4.patch" | sha256sum -c - && \
    git apply /src/nginx/4.patch && \
    wget -q https://raw.githubusercontent.com/openresty/openresty/master/patches/nginx/"$RCP_VER"/nginx-"$RCP_VER"-resolver_conf_parsing.patch -O /src/nginx/5.patch && \
    echo "bda9db7d2766b20c9490f1ccd6d2da72fee402ade219efb32fe341851dbdd7c8  /src/nginx/5.patch" | sha256sum -c - && \
    git apply /src/nginx/5.patch && \
    wget -q https://raw.githubusercontent.com/zlib-ng/patches/master/nginx/"$ZNP_VER"-zlib-ng.patch -O /src/nginx/6.patch && \
    echo "bcd0f2fb9723fc1f251f94cead8d5160e767f7d4a04365331396a72a9ba54c6b  /src/nginx/6.patch" | sha256sum -c - && \
    git apply /src/nginx/6.patch && \
    wget -q https://github.com/nginx/nginx/commit/dea68dbf126f40a8acd09bac885a955be459162e.patch -O /src/nginx/7.patch && \
    echo "35f1d899df53ef5507b3f490c99ce40fe903de01a425908544bd9de092b2460e  /src/nginx/7.patch" | sha256sum -c - && \
    git apply /src/nginx/7.patch && \
    wget -q https://patch-diff.githubusercontent.com/raw/nginx/nginx/pull/1430.patch -O /src/nginx/8.patch && \
    echo "c8e827d50314b6ec027677ae8c70b11f805408af3efb5175bf377071bd2a14a5  /src/nginx/8.patch" | sha256sum -c - && \
    git apply /src/nginx/8.patch && \
    git apply /src/nginx-footer.patch && \
    git apply /src/nginx-ip-sni.patch && \
    git apply /src/nginx-buffer-log.patch && \
    git apply /src/nginx-ech-boringssl-awslc.patch && \
    git apply /src/nginx-cert-compression-brotli.patch && \
    \
    git-clone-commit.sh https://github.com/HanadaLee/ngx_http_brotli_module "$NB_VER" /src/ngx_http_brotli_module && \
    git-clone-commit.sh https://github.com/HanadaLee/ngx_http_unbrotli_filter_module "$NUB_VER" /src/ngx_http_unbrotli_filter_module && \
    git-clone-commit.sh https://github.com/hsw/zstd-nginx-module "$ZNM_VER" /src/zstd-nginx-module && \
    git-clone-commit.sh https://github.com/HanadaLee/ngx_http_unzstd_filter_module "$NHUZFM_VER" /src/ngx_http_unzstd_filter_module && \
    git-clone-commit.sh https://github.com/aperezdc/ngx-fancyindex "$NF_VER" /src/ngx-fancyindex && \
    cd /src/ngx-fancyindex && \
    wget -q https://patch-diff.githubusercontent.com/raw/aperezdc/ngx-fancyindex/pull/176.patch -O /src/ngx-fancyindex/1.patch && \
    echo "0b76992c0981e5beda1f158493d0334dcbdfe381348ea0eeeb09123bd9aaa4d3  /src/ngx-fancyindex/1.patch" | sha256sum -c - && \
    git apply /src/ngx-fancyindex/1.patch && \
    git-clone-commit.sh https://github.com/openresty/headers-more-nginx-module "$HMNM_VER" /src/headers-more-nginx-module && \
    git-clone-commit.sh https://github.com/vision5/ngx_devel_kit "$NDK_VER" /src/ngx_devel_kit && \
    git-clone-commit.sh https://github.com/openresty/lua-nginx-module "$LNM_VER" /src/lua-nginx-module && \
    cd /src/lua-nginx-module && \
    git apply /src/lua-nginx-module-aws-lc.patch && \
    \
    git-clone-commit.sh https://github.com/nginx/njs "$NJS_VER" /src/njs && \
    git-clone-commit.sh https://github.com/kvspb/nginx-auth-ldap "$NAL_VER" /src/nginx-auth-ldap && \
    git-clone-commit.sh https://github.com/vozlt/nginx-module-vts "$VTS_VER" /src/nginx-module-vts && \
    git-clone-commit.sh https://github.com/gabihodoroaga/nginx-ntlm-module "$NNTLM_VER" /src/nginx-ntlm-module && \
    git-clone-commit.sh https://github.com/leev/ngx_http_geoip2_module "$NHG2M_VER" /src/ngx_http_geoip2_module

RUN cd /src/nginx && \
    /src/nginx/auto/configure \
    --build=NPMplus \
    --user=root \
    --group=root \
    --with-debug \
    --with-compat \
    --with-threads \
    --with-file-aio \
    --with-libatomic \
    --with-pcre \
    --with-pcre-jit \
    --without-select_module \
    --without-poll_module \
    --with-stream \
    --with-stream_ssl_module \
    --with-stream_ssl_preread_module \
    --with-stream_realip_module \
    --with-http_v2_module \
    --with-http_v3_module \
    --with-http_ssl_module \
    --with-http_realip_module \
    --with-http_gunzip_module \
    --with-http_gzip_static_module \
    --with-http_sub_module \
    --with-http_addition_module \
    --with-http_stub_status_module \
    --with-http_auth_request_module \
    --add-module=/src/ngx_http_brotli_module \
    --add-module=/src/ngx_http_unbrotli_filter_module \
    --add-module=/src/zstd-nginx-module \
    --add-module=/src/ngx_http_unzstd_filter_module \
    --add-module=/src/ngx-fancyindex \
    --add-module=/src/headers-more-nginx-module \
    --add-module=/src/ngx_devel_kit \
    --add-module=/src/lua-nginx-module \
    --add-dynamic-module=/src/njs/nginx \
    --add-dynamic-module=/src/nginx-auth-ldap \
    --add-dynamic-module=/src/nginx-module-vts \
    --add-dynamic-module=/src/nginx-ntlm-module \
    --add-dynamic-module=/src/ngx_http_geoip2_module \
    --with-cc-opt="-DZSTD_STATIC_LINKING_ONLY" \
    --with-ld-opt="$LDFLAGS" && \
    \
    make -j "$(nproc)" install

RUN find /usr/local/nginx/modules -name "*.so" -exec llvm-strip -s {} \; && \
    llvm-strip -s /usr/local/nginx/sbin/nginx && \
    llvm-strip -s /usr/local/lib/libcrypto.so && \
    llvm-strip -s /usr/local/lib/libssl.so && \
    llvm-strip -s /usr/local/bin/bssl && \
    \
    find /usr/local/nginx/modules -name "*.so" -exec file {} \; && \
    file /usr/local/nginx/sbin/nginx && \
    file /usr/local/lib/libcrypto.so && \
    file /usr/local/lib/libssl.so && \
    file /usr/local/bin/bssl && \
    /usr/local/nginx/sbin/nginx -V


FROM --platform="$BUILDPLATFORM" alpine:3.24.1@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b AS frontend
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]
ARG NODE_ENV=production
WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml /app/
RUN apk upgrade --no-cache -a && \
    apk add --no-cache nodejs pnpm llvm file brotli && \
    pnpm install --frozen-lockfile && \
    find /app/node_modules -name "*.map" -delete && \
    find /app/node_modules -name "*.node" -type f -exec llvm-strip -s {} \; && \
    find /app/node_modules -name "*.node" -type f -exec file {} \;
COPY frontend /app
RUN pnpm formatjs compile-folder src/locale/src src/locale/lang && \
    pnpm tsc -b && \
    pnpm vite build && \
    find /app/dist -type f ! -name "*.jpg" ! -name "*.png" -exec brotli -q 11 {} \;

FROM --platform=$BUILDPLATFORM alpine:3.24.1@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b AS backend
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]
ARG NODE_ENV=production
ARG TARGETARCH
WORKDIR /app
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml /app/
RUN apk upgrade --no-cache -a && \
    apk add --no-cache nodejs pnpm llvm file && \
    pnpm install --frozen-lockfile --prod && \
    find /app/node_modules -name "*.map" -delete && \
    rm -vr /app/node_modules/better-sqlite3/deps/sqlite3 && \
    case "$TARGETARCH" in \
      amd64) keep="linuxmusl-x64.node" ;; \
      arm64) keep="linuxmusl-arm64.node" ;; \
      *) keep="linuxmusl-*.node" ;; \
    esac && \
    find /app/node_modules/better-sqlite3/prebuilds -name '*.node' ! -name "$keep" -delete && \
    find /app/node_modules -name "*.node" -type f -exec llvm-strip -s {} \; && \
    find /app/node_modules -name "*.node" -type f -exec file {} \;
COPY backend /app


FROM alpine:3.24.1@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]
ENV NODE_ENV=production
ARG LRC_VER=be42297c57dc2393cdbb09d4597d9d4840a7c769 # v0.1.35rc1
ARG LRL_VER=3ff6300e68b73ba20e909c7d16bd839aef2e5a4b # v0.15
ARG LCSB_VER=35455a64e11368b3df73a381b09c056a3ee77e24 # v1.0.16
ARG COF_VER=da93e0cec7fdb1a80f4972f75b3638763d012c0e # main
ARG NBF_VER=5cee8db2a505f2a253e24691399c828c043071fc # master

COPY --from=nginx /usr/local/nginx                                                                         /usr/local/nginx
COPY --from=nginx /usr/local/bin/bssl                                                                      /usr/local/bin/bssl
COPY --from=nginx /usr/local/lib/libssl.so                                                                 /usr/local/lib/libssl.so
COPY --from=nginx /usr/local/lib/libcrypto.so                                                              /usr/local/lib/libcrypto.so

COPY --from=backend  /app      /app

COPY rootfs  /
COPY MIT.LICENSE /MIT.LICENSE
COPY COPYING /COPYING

WORKDIR /app
RUN apk upgrade --no-cache -a && \
    apk add --no-cache tzdata tini dinit llvm-libunwind libc++ \
                       pcre2 luajit zlib-ng brotli zstd lua5.1-cjson libxml2 libldap quickjs-ng-libs libmaxminddb-libs \
                       curl coreutils findutils grep jq openssl shadow su-exec util-linux-misc moreutils \
                       bash bash-completion nano \
                       logrotate goaccess fcgi \
                       luarocks5.1 git make \
                       nodejs python3 && \
    \
    luarocks-5.1 install lua-resty-http && \
    luarocks-5.1 install lua-resty-string && \
    luarocks-5.1 install lua-resty-openssl && \
    \
    git config --global advice.detachedHead false && \
    git config --global init.defaultBranch main && \
    \
    git-clone-commit.sh https://github.com/openresty/lua-resty-core "$LRC_VER" /src/lua-resty-core && \
    cd /src/lua-resty-core && \
    make -j "$(nproc)" install LUA_LIB_DIR=/usr/local/share/lua/5.1 && \
    \
    git-clone-commit.sh https://github.com/openresty/lua-resty-lrucache "$LRL_VER" /src/lua-resty-lrucache && \
    cd /src/lua-resty-lrucache && \
    make -j "$(nproc)" install LUA_LIB_DIR=/usr/local/share/lua/5.1 && \
    \
    git-clone-commit.sh https://github.com/crowdsecurity/lua-cs-bouncer "$LCSB_VER" /src/lua-cs-bouncer && \
    mv /src/lua-cs-bouncer/lib/* /usr/local/share/lua/5.1 && \
    mv /src/lua-cs-bouncer/templates/captcha.html /etc/captcha.html.original && \
    mv /src/lua-cs-bouncer/templates/ban.html /etc/ban.html.original && \
    \
    cd && \
    rm -vr /src /tmp/luarocks_local_cache-* && \
    apk del --no-cache luarocks5.1 git make && \
    \
    sed -i "s|placeholder|$(jq -r .version /app/package.json)|g" /usr/local/nginx/conf/conf.d/crowdsec.conf.disabled && \
    \
    python3 -m venv /usr/local && \
    pip install --no-cache-dir --upgrade pip certbot && \
    \
    wget -q https://raw.githubusercontent.com/tomwassenberg/certbot-ocsp-fetcher/"$COF_VER"/certbot-ocsp-fetcher -O /usr/local/bin/certbot-ocsp-fetcher.sh && \
    echo "60148ed2ffef2f1354427d3e080400d008132f8e5fb014f721f5986f438dd621  /usr/local/bin/certbot-ocsp-fetcher.sh" | sha256sum -c - && \
    sed -i "s|/live||g" /usr/local/bin/certbot-ocsp-fetcher.sh && \
    \
    wget -q https://raw.githubusercontent.com/vasilevich/nginxbeautifier/"$NBF_VER"/index.js -O /usr/local/bin/nginxbeautifier && \
    echo "316349857e6de63d21bec1eee155819237d67b338be7c35514879ac8b00848fc  /usr/local/bin/nginxbeautifier" | sha256sum -c - && \
    wget -q https://raw.githubusercontent.com/vasilevich/nginxbeautifier/"$NBF_VER"/nginxbeautifier.js -O /usr/local/bin/nginxbeautifier.js && \
    echo "406f715ae944cc46ae31e79a1bc3ea758f91605621113b8a29f5332fe13f0a83  /usr/local/bin/nginxbeautifier.js" | sha256sum -c - && \
    \
    ln -s /usr/local/nginx/sbin/nginx /usr/local/bin/nginx && \
    ln -s /app/password-reset.js /usr/local/bin/password-reset.js && \
    ln -s /app/index.js /usr/local/bin/index.js && \
    \
    chmod +x /usr/local/bin/*

COPY --from=frontend /app/dist /app/frontend

ENTRYPOINT ["tini", "--", "entrypoint.sh"]
HEALTHCHECK CMD ["healthcheck.sh"]

LABEL com.centurylinklabs.watchtower.monitor-only="true"
LABEL wud.watch="false"
LABEL wud.watch.digest="false"
