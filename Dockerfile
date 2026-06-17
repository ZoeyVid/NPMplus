# syntax=docker/dockerfile:1.24.0@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89
FROM alpine:3.24.1@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b AS nginx
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]

ARG LUAJIT_INC=/usr/include/luajit-2.1
ARG LUAJIT_LIB=/usr/lib

ARG AWSLC_VER=6f246af4cd1de8cee8c62d76139bcda299c1aa00 # v5.0.0

ARG NGINX_VER=fe0e735ee2f17967871863b0d25607990eda0ce9 # release-1.31.2
ARG DTR_VER=1.29.2
ARG RCP_VER=1.31.1
ARG ZNP_VER=1.30.0

ARG NB_VER=a71f9312c2deb28875acc7bacfdd5695a111aa53 # master
ARG NUB_VER=60bed634504967a323645f8f53566cca3f2c3f53 # main
ARG ZNM_VER=057a7d339af1111d04b5a9ac5ae9b0250d17cd94 # master
ARG NHUZFM_VER=37e77ed348c242e222f2ae2b02c2e445e0ee2dc6 # main
ARG NF_VER=047589e4dc0041517b8a47739fa960c430c4045e # v0.6.0
ARG HMNM_VER=2b1debde426783b8f42246149d3638644a6347cb # v0.39
ARG NDK_VER=bd44d16302273052d6005d7bdb55f74e23813de3 # v0.3.4
ARG LNM_VER=4b21d8f5fd3cc94fd25c530b3a61405af9666d0b # v0.10.31

ARG NJS_VER=9ead4e71f74a27279f3212bdb6cadb0e86981a1b # 0.9.9
ARG NAL_VER=241200eac8e4acae74d353291bd27f79e5ca3dc4 # master
ARG VTS_VER=b2a036ab6c1ffd5615f9ea57d6710287590735cd # v0.2.5
ARG NNTLM_VER=3da77b0cb30e517dfee01d7e7f7d649144d24051 # master
ARG NHG2M_VER=cbaa35461c62a99d2577e6bae3273492502d8769 # 3.4

ARG OASA_VER=2f46293b32c58d5be250aa6d3bac0e4ba9260738 # main


WORKDIR /src
COPY patches/*.patch /src
COPY rootfs/usr/local/bin/git-clone-commit.sh /usr/local/bin/git-clone-commit.sh

RUN apk upgrade --no-cache -a && \
    apk add --no-cache git clang lld compiler-rt llvm-libunwind-dev libc++-dev linux-headers cmake ninja make llvm file \
                       libatomic_ops-dev pcre2-dev luajit-dev zlib-ng-dev brotli-dev zstd-dev libxslt-dev openldap-dev quickjs-ng-dev libmaxminddb-dev clang-dev

RUN for f in $(apk info --no-cache -qL libgcc-static libstdc++-dev); do rm /"$f"; done && \
    echo "-fuse-ld=lld --rtlib=compiler-rt --unwindlib=libunwind -stdlib=libc++ -D_LIBCPP_HARDENING_MODE=_LIBCPP_HARDENING_MODE_EXTENSIVE" | tee /etc/clang*/*.cfg

ARG CC=clang
ARG CXX=clang++
ARG LD=ld.lld
ARG AR=llvm-ar

ARG FLAGS
ARG CFLAGS="$FLAGS -m64 -O3 -pipe -flto=full -ffunction-sections -fdata-sections -fno-math-errno -ffp-contract=fast -fstack-clash-protection -fstack-protector-strong -fzero-call-used-regs=used-gpr -fstrict-flex-arrays=3 -ftrivial-auto-var-init=zero -fno-delete-null-pointer-checks -fno-strict-overflow -fno-strict-aliasing -fno-semantic-interposition -fno-plt -U_FORTIFY_SOURCE -D_FORTIFY_SOURCE=3 -Wformat=2 -Werror=format-security -Wno-sign-compare"
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
    echo "1b82e6da05f533683c3c62e376aa707d3c79265e03dd5be5d740e658122cc171  /src/nginx/2.patch" | sha256sum -c - && \
    git apply /src/nginx/2.patch && \
    wget -q https://patch-diff.githubusercontent.com/raw/nginx/nginx/pull/1333.patch -O /src/nginx/3.patch && \
    echo "01bf75b130b8f91075ec913a400a8debfab6da0ac609711c7d412ddbe59dd898  /src/nginx/3.patch" | sha256sum -c - && \
    git apply /src/nginx/3.patch && \
    wget -q https://raw.githubusercontent.com/nginx-modules/ngx_http_tls_dyn_size/refs/heads/master/nginx__dynamic_tls_records_"$DTR_VER"%2B.patch -O /src/nginx/4.patch && \
    echo "0aa9c73e7515dbbd48ecc798f7894412c1a50e96e98aee25847e823059faf821  /src/nginx/4.patch" | sha256sum -c - && \
    git apply /src/nginx/4.patch && \
    wget -q https://raw.githubusercontent.com/openresty/openresty/refs/heads/master/patches/nginx/"$RCP_VER"/nginx-"$RCP_VER"-resolver_conf_parsing.patch -O /src/nginx/5.patch && \
    echo "bda9db7d2766b20c9490f1ccd6d2da72fee402ade219efb32fe341851dbdd7c8  /src/nginx/5.patch" | sha256sum -c - && \
    git apply /src/nginx/5.patch && \
    wget -q https://raw.githubusercontent.com/zlib-ng/patches/refs/heads/master/nginx/"$ZNP_VER"-zlib-ng.patch -O /src/nginx/6.patch && \
    echo "bcd0f2fb9723fc1f251f94cead8d5160e767f7d4a04365331396a72a9ba54c6b  /src/nginx/6.patch" | sha256sum -c - && \
    git apply /src/nginx/6.patch && \
    git apply /src/nginx-footer.patch && \
    git apply /src/nginx-ip-sni.patch && \
    git apply /src/nginx-gso-fix.patch && \
    git apply /src/nginx-buffer-log.patch && \
    git apply /src/nginx-ech-boringssl-awslc.patch && \
    git apply /src/nginx-cert-compression-brotli.patch && \
    \
    git-clone-commit.sh https://github.com/google/ngx_brotli "$NB_VER" /src/ngx_brotli && \
    cd /src/ngx_brotli && \
    git apply /src/ngx_brotli.patch && \
    git-clone-commit.sh https://github.com/clyfish/ngx_unbrotli "$NUB_VER" /src/ngx_unbrotli && \
    cd /src/ngx_unbrotli && \
    git apply /src/ngx_unbrotli.patch && \
    git-clone-commit.sh https://github.com/tokers/zstd-nginx-module "$ZNM_VER" /src/zstd-nginx-module && \
    cd /src/zstd-nginx-module && \
    wget -q https://patch-diff.githubusercontent.com/raw/tokers/zstd-nginx-module/pull/23.patch -O /src/zstd-nginx-module/1.patch && \
    echo "7bd3c71770305ab44defe5e2768a62d870061645b095b9564d4afd57a64ad3b9  /src/zstd-nginx-module/1.patch" | sha256sum -c - && \
    wget -q https://patch-diff.githubusercontent.com/raw/tokers/zstd-nginx-module/pull/44.patch -O /src/zstd-nginx-module/2.patch && \
    echo "577dc3e2d6e0378520cee6f621fa9824dd571992185cb58e2198ffa9bf814c6f  /src/zstd-nginx-module/2.patch" | sha256sum -c - && \
    git apply /src/zstd-nginx-module.patch && \
    git apply /src/zstd-nginx-module/1.patch && \
    git apply /src/zstd-nginx-module/2.patch && \
    git-clone-commit.sh https://github.com/HanadaLee/ngx_http_unzstd_filter_module "$NHUZFM_VER" /src/ngx_http_unzstd_filter_module && \
    git-clone-commit.sh https://github.com/aperezdc/ngx-fancyindex "$NF_VER" /src/ngx-fancyindex && \
    git-clone-commit.sh https://github.com/openresty/headers-more-nginx-module "$HMNM_VER" /src/headers-more-nginx-module && \
    git-clone-commit.sh https://github.com/vision5/ngx_devel_kit "$NDK_VER" /src/ngx_devel_kit && \
    git-clone-commit.sh https://github.com/openresty/lua-nginx-module "$LNM_VER" /src/lua-nginx-module && \
    cd /src/lua-nginx-module && \
    git apply /src/lua-nginx-module.patch && \
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
    --add-module=/src/ngx_brotli \
    --add-module=/src/ngx_unbrotli \
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
    --with-ld-opt="$LDFLAGS" && \
    \
    make -j "$(nproc)" install

RUN git-clone-commit.sh https://github.com/openappsec/attachment "$OASA_VER" /src/attachment && \
    cd /src/attachment && \
    git apply /src/attachment.patch && \
    cmake /src/attachment -G Ninja && \
    ninja && \
    mv -v /src/attachment/attachments/nginx/ngx_module/libngx_module.so /usr/local/nginx/modules/libngx_module.so

RUN find /usr/local/nginx/modules -name "*.so" -exec llvm-strip -s {} \; && \
    llvm-strip -s /usr/local/nginx/sbin/nginx && \
    llvm-strip -s /usr/local/lib/libcrypto.so && \
    llvm-strip -s /usr/local/lib/libssl.so && \
    llvm-strip -s /usr/local/bin/bssl && \
    llvm-strip -s /src/attachment/core/shmem_ipc_2/libshmem_ipc_2.so && \
    llvm-strip -s /src/attachment/core/compression/libosrc_compression_utils.so && \
    llvm-strip -s /src/attachment/attachments/nginx/nginx_attachment_util/libosrc_nginx_attachment_util.so && \
    \
    find /usr/local/nginx/modules -name "*.so" -exec file {} \; && \
    file /usr/local/nginx/sbin/nginx && \
    file /usr/local/lib/libcrypto.so && \
    file /usr/local/lib/libssl.so && \
    file /usr/local/bin/bssl && \
    file /src/attachment/core/shmem_ipc_2/libshmem_ipc_2.so && \
    file /src/attachment/core/compression/libosrc_compression_utils.so && \
    file /src/attachment/attachments/nginx/nginx_attachment_util/libosrc_nginx_attachment_util.so && \
    /usr/local/nginx/sbin/nginx -V


FROM --platform="$BUILDPLATFORM" alpine:3.24.1@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b AS frontend
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]
ARG NODE_ENV=production
WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml /app/
RUN apk upgrade --no-cache -a && \
    apk add --no-cache nodejs pnpm llvm file && \
    pnpm install --frozen-lockfile && \
    pnpm cache delete && \
    find /app/node_modules -name "*.map" -delete && \
    find /app/node_modules -name "*.node" -type f -exec llvm-strip -s {} \; && \
    find /app/node_modules -name "*.node" -type f -exec file {} \;
COPY frontend /app
RUN pnpm formatjs compile-folder src/locale/src src/locale/lang && \
    pnpm tsc && \
    pnpm vite build

FROM alpine:3.24.1@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b AS backend
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]
ARG NODE_ENV=production
WORKDIR /app
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml /app/
RUN apk upgrade --no-cache -a && \
    apk add --no-cache nodejs pnpm llvm file && \
    pnpm install --frozen-lockfile --prod && \
    pnpm cache delete && \
    find /app/node_modules -name "*.map" -delete && \
    rm -r /app/node_modules/better-sqlite3/deps/sqlite3 && \
    find /app/node_modules -name "*.node" -type f -exec llvm-strip -s {} \; && \
    find /app/node_modules -name "*.node" -type f -exec file {} \;
COPY backend /app


FROM alpine:3.24.1@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]
ENV NODE_ENV=production
ARG LRC_VER=6fec23e2149c88b33b39fec8a5ebdd67a3e0dd88 # v0.1.34rc3
ARG LRL_VER=3ff6300e68b73ba20e909c7d16bd839aef2e5a4b # v0.15
ARG LCSB_VER=3e82dd61508ed9683b5007f823c69b112c59ac6f # v1.0.14

COPY --from=nginx /usr/local/nginx                                                                         /usr/local/nginx
COPY --from=nginx /usr/local/bin/bssl                                                                      /usr/local/bin/bssl
COPY --from=nginx /usr/local/lib/libssl.so                                                                 /usr/local/lib/libssl.so
COPY --from=nginx /usr/local/lib/libcrypto.so                                                              /usr/local/lib/libcrypto.so
COPY --from=nginx /src/attachment/core/shmem_ipc_2/libshmem_ipc_2.so                                       /usr/local/lib/libshmem_ipc_2.so
COPY --from=nginx /src/attachment/core/compression/libosrc_compression_utils.so                            /usr/local/lib/libosrc_compression_utils.so
COPY --from=nginx /src/attachment/attachments/nginx/nginx_attachment_util/libosrc_nginx_attachment_util.so /usr/local/lib/libosrc_nginx_attachment_util.so

COPY --from=backend  /app      /app

COPY rootfs  /
COPY LICENSE /LICENSE
COPY COPYING /COPYING

WORKDIR /app
RUN apk upgrade --no-cache -a && \
    apk add --no-cache tzdata tini llvm-libunwind libc++ \
                       pcre2 luajit zlib-ng brotli zstd lua5.1-cjson libxml2 libldap quickjs-ng-libs libmaxminddb-libs \
                       curl coreutils findutils grep jq openssl shadow su-exec util-linux-misc \
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
    rm -r /src /tmp/luarocks_local_cache-* && \
    apk del --no-cache luarocks5.1 git make && \
    \
    sed -i "s|placeholder|$(cat /app/package.json | jq -r .version)|g" /usr/local/nginx/conf/conf.d/crowdsec.conf.disabled && \
    \
    python3 -m venv /usr/local && \
    pip install --no-cache-dir --upgrade pip certbot && \
    \
    wget -q https://raw.githubusercontent.com/tomwassenberg/certbot-ocsp-fetcher/refs/heads/main/certbot-ocsp-fetcher -O - | sed "s|/live||g" > /usr/local/bin/certbot-ocsp-fetcher.sh && \
    wget -q https://raw.githubusercontent.com/vasilevich/nginxbeautifier/5cee8db2a505f2a253e24691399c828c043071fc/index.js -O /usr/local/bin/nginxbeautifier && \
    wget -q https://raw.githubusercontent.com/vasilevich/nginxbeautifier/5cee8db2a505f2a253e24691399c828c043071fc/nginxbeautifier.js -O /usr/local/bin/nginxbeautifier.js && \
    \
    ln -s /usr/local/nginx/sbin/nginx /usr/local/bin/nginx && \
    ln -s /app/password-reset.js /usr/local/bin/password-reset.js && \
    ln -s /app/sqlite-vaccum.js /usr/local/bin/sqlite-vaccum.js && \
    ln -s /app/index.js /usr/local/bin/index.js && \
    \
    chmod +x /usr/local/bin/*

COPY --from=frontend /app/dist /app/frontend

ENTRYPOINT ["tini", "--", "entrypoint.sh"]
HEALTHCHECK CMD healthcheck.sh

LABEL com.centurylinklabs.watchtower.monitor-only="true"
LABEL wud.watch="false"
LABEL wud.watch.digest="false"
